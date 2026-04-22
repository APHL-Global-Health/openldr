"""
Agentic inference for small local models via llama-cpp-python.

Two-path design:
1. Deterministic routing — a lightweight selector picks the right tool
   directly from the user query, skipping free-form generation entirely.
2. Model-driven fallback — if the selector isn't confident, the LLM
   generates a tool call (or plain answer) in the normal agentic loop.

First generation pass is always buffered (never streamed token-by-token)
so code-fence leakage and tool-call syntax are stripped before the client
sees anything.  The final answer pass streams token-by-token for real-time
feel.
"""
import asyncio
import json
from typing import AsyncGenerator

from core.config import settings
from core.state import loaded_model
from services.mcp_client import fetch_tools, execute_tool, format_tools_for_prompt
from services.result_compactor import compact_tool_result
from services.tool_prompt import (
    build_system_prompt,
    extract_tool_call,
    format_tool_result,
    strip_tool_call,
    strip_thinking,
    FINAL_ANSWER_SYSTEM_PROMPT,
)
from services.tool_router import select_tool_for_query


# ── helpers ────────────────────────────────────────────────────────────────────

def _latest_user_message(messages: list[dict]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return m.get("content", "")
    return ""


THINKING_INSTRUCTION = (
    "\n\n## IMPORTANT: Thinking mode is ON\n"
    "You MUST start your response with a <think> block. "
    "Inside it, analyze the data, plan your formatting, and note key findings. "
    "Then close it with </think> and write your formatted answer.\n\n"
    "REQUIRED format:\n"
    "<think>\n"
    "- What data did the tool return?\n"
    "- What are the key fields to highlight?\n"
    "- How should I format this (table vs list)?\n"
    "</think>\n\n"
    "Your formatted answer here..."
)


def _inject_thinking_control(messages: list[dict], enable_thinking: bool) -> list[dict]:
    """
    Toggle thinking mode by adding thinking instructions to the system prompt.
    Works with any model — instructs the model to use <think> tags explicitly.
    """
    if not enable_thinking or not messages:
        return messages

    if messages[0].get("role") == "system":
        return [
            {**messages[0], "content": messages[0]["content"] + THINKING_INSTRUCTION},
            *messages[1:],
        ]

    return [{"role": "system", "content": THINKING_INSTRUCTION.strip()}, *messages]


def _generate_buffered(
    llm, messages: list[dict], max_tokens: int, temperature: float,
    enable_thinking: bool = False,
) -> str:
    """Non-streaming generation — returns the full text at once."""
    response = llm.create_chat_completion(
        messages=_inject_thinking_control(messages, enable_thinking),
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
    )
    return response.get("choices", [{}])[0].get("message", {}).get("content", "")


async def _stream_final_answer(
    messages: list[dict],
    max_new_tokens: int,
    temperature: float,
    enable_thinking: bool = False,
) -> AsyncGenerator[str, None]:
    """Stream the final answer token-by-token (no tool call expected)."""
    llm = loaded_model.get("model")
    if not llm:
        yield json.dumps({"error": "No model loaded"})
        return

    response = llm.create_chat_completion(
        messages=_inject_thinking_control(messages, enable_thinking),
        max_tokens=max_new_tokens,
        temperature=temperature,
        stream=True,
    )

    for chunk in response:
        delta = chunk.get("choices", [{}])[0].get("delta", {})
        token = delta.get("content")
        if token:
            yield json.dumps({"token": token})
            await asyncio.sleep(0)  # flush to event loop so SSE sends immediately


# ── main entry point ───────────────────────────────────────────────────────────

async def agentic_stream(
    messages: list[dict],
    max_new_tokens: int = 512,
    temperature: float = 0.7,
    max_tool_calls: int = 3,
    enable_thinking: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Main agentic streaming generator.

    Yields SSE-compatible JSON events:
      {"token": "..."}                          — response text
      {"status": "...", "tool_call": {...}, "routing": {...}}  — tool executing
      {"done": true}                            — stream finished
      {"error": "..."}                          — something went wrong
    """
    max_new_tokens = max(max_new_tokens, 512)

    llm = loaded_model.get("model")
    if not llm:
        yield json.dumps({"error": "No model loaded"})
        return

    tools = await fetch_tools()

    # ── Path 1: deterministic routing ─────────────────────────────────────────
    selection = select_tool_for_query(_latest_user_message(messages), tools)
    if selection.should_call_tool and selection.tool_name:
        yield json.dumps({
            "status": f"Querying {selection.tool_name}...",
            "tool_call": {"tool": selection.tool_name, "args": selection.args or {}},
            "routing": {
                "mode": "deterministic",
                "confidence": selection.confidence,
                "reason": selection.reason,
            },
        })

        raw_result = await execute_tool(selection.tool_name, selection.args or {})
        compact_result = compact_tool_result(selection.tool_name, raw_result)

        # Send reasoning data so frontend can show what the system "thought"
        if enable_thinking:
            yield json.dumps({
                "reasoning": (
                    f"Tool: {selection.tool_name}\n"
                    f"Route: {selection.reason} (confidence: {selection.confidence})\n"
                    f"Args: {json.dumps(selection.args or {})}\n\n"
                    f"Raw result:\n{compact_result[:1500]}"
                ),
            })

        answer_messages = [
            {"role": "system", "content": FINAL_ANSWER_SYSTEM_PROMPT},
            *messages[-4:],
            {"role": "user", "content": format_tool_result(selection.tool_name, compact_result)},
        ]
        async for event in _stream_final_answer(answer_messages, max_new_tokens, 0.2, enable_thinking=enable_thinking):
            yield event

        yield json.dumps({"done": True})
        return

    # ── Path 2: model-driven fallback ──────────────────────────────────────────
    tools_text = format_tools_for_prompt(tools)
    system_prompt = build_system_prompt(tools_text)
    full_messages = [{"role": "system", "content": system_prompt}, *messages]

    tool_calls_made = 0
    max_calls = min(max_tool_calls, settings.AI_MAX_TOOL_CALLS)

    while tool_calls_made <= max_calls:
        is_first_pass = tool_calls_made == 0

        if is_first_pass:
            # Buffer first pass to detect tool calls before streaming
            full_output = _generate_buffered(llm, full_messages, max_new_tokens, temperature, enable_thinking=enable_thinking)
        else:
            # Final answer pass — stream token-by-token and collect for tool-call check
            collected = []
            response = llm.create_chat_completion(
                messages=_inject_thinking_control(full_messages, enable_thinking),
                max_tokens=max_new_tokens,
                temperature=temperature,
                stream=True,
            )
            for chunk in response:
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                token = delta.get("content")
                if token:
                    collected.append(token)
                    yield json.dumps({"token": token})
                    await asyncio.sleep(0)
            full_output = "".join(collected)

        # ── No tool call ───────────────────────────────────────────────────────
        parsed = extract_tool_call(full_output)
        if not parsed:
            if is_first_pass:
                remaining = strip_tool_call(full_output)
                if remaining:
                    yield json.dumps({"token": remaining})
            break

        # ── Tool call detected ─────────────────────────────────────────────────
        tool_name, tool_args = parsed
        tool_calls_made += 1

        yield json.dumps({
            "status": f"Querying {tool_name}...",
            "tool_call": {"tool": tool_name, "args": tool_args},
            "routing": {"mode": "model", "reason": "Fallback to model-generated tool call."},
        })

        raw_tool_result = await execute_tool(tool_name, tool_args)
        compact_result = compact_tool_result(tool_name, raw_tool_result)

        if enable_thinking:
            yield json.dumps({
                "reasoning": (
                    f"Tool: {tool_name}\n"
                    f"Route: model-generated tool call\n"
                    f"Args: {json.dumps(tool_args)}\n\n"
                    f"Raw result:\n{compact_result[:1500]}"
                ),
            })

        full_messages.append({"role": "assistant", "content": full_output})
        full_messages.append({
            "role": "user",
            "content": format_tool_result(tool_name, compact_result),
        })

    yield json.dumps({"done": True})
