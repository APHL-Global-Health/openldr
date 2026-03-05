"""
Safer agentic inference for small local models.

Flow:
1. Try deterministic MCP tool selection based on the latest user request.
2. If a tool matches safely, execute it directly.
3. Compact the tool result.
4. Let the model answer using ONLY the compact evidence.
5. Fall back to the older free-form tool-call loop only when routing is unclear.
"""
import json
import threading
from typing import AsyncGenerator

from transformers import TextIteratorStreamer

from core.config import settings
from core.state import loaded_model
from services.context_budget import build_budgeted_prompt, tokenize_budgeted_prompt
from services.mcp_client import fetch_tools, execute_tool, format_tools_for_prompt
from services.result_compactor import compact_tool_result
from services.tool_prompt import (
    build_system_prompt,
    extract_tool_call,
    format_tool_result,
    strip_tool_call,
)
from services.tool_router import select_tool_for_query



def _run_generation(model, tokenizer, inputs, streamer, max_new_tokens, temperature):
    generation_kwargs = {
        **inputs,
        "streamer": streamer,
        "max_new_tokens": max_new_tokens,
        "temperature": temperature,
        "do_sample": temperature > 0,
        "pad_token_id": tokenizer.eos_token_id,
    }
    model.generate(**generation_kwargs)


def _prepare_inputs(model, tokenizer, messages: list[dict]) -> dict:
    device = next(model.parameters()).device
    budgeted = build_budgeted_prompt(tokenizer, messages)
    return tokenize_budgeted_prompt(tokenizer, budgeted.prompt, device)


async def _stream_final_answer(
    messages: list[dict],
    max_new_tokens: int,
    temperature: float,
) -> AsyncGenerator[str, None]:
    model = loaded_model.get("model")
    tokenizer = loaded_model.get("tokenizer")
    if not model or not tokenizer:
        yield json.dumps({"error": "No model loaded"})
        return

    inputs = _prepare_inputs(model, tokenizer, messages)
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)

    thread = threading.Thread(
        target=_run_generation,
        args=(model, tokenizer, inputs, streamer, max_new_tokens, temperature),
    )
    thread.start()

    for token in streamer:
        yield json.dumps({"token": token})

    thread.join()


def _latest_user_message(messages: list[dict]) -> str:
    for message in reversed(messages):
        if message.get("role") == "user":
            return message.get("content", "")
    return messages[-1].get("content", "") if messages else ""


"""
Agentic inference service
--------------------------
Two-path design:
1. Deterministic routing  — a lightweight selector picks the right tool
   directly from the user query, skipping free-form generation entirely.
2. Model-driven fallback  — if the selector isn't confident, the LLM
   generates a tool call (or plain answer) in the normal agentic loop.

First generation pass is always buffered (never streamed token-by-token)
so code-fence leakage and tool-call syntax are stripped before the client
sees anything.  The final answer pass streams token-by-token for real-time
feel.
"""
import json
import threading
from typing import AsyncGenerator

from transformers import TextIteratorStreamer

from core.config import settings
from core.state import loaded_model
from services.mcp_client import fetch_tools, execute_tool, format_tools_for_prompt
from services.tool_prompt import (
    build_system_prompt,
    extract_tool_call,
    format_tool_result,
    strip_tool_call,
    FINAL_ANSWER_SYSTEM_PROMPT,
)
from services.tool_router import select_tool_for_query


# ── helpers ────────────────────────────────────────────────────────────────────

def _latest_user_message(messages: list[dict]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return m.get("content", "")
    return ""


def _run_generation(model, tokenizer, inputs, streamer, max_new_tokens, temperature):
    model.generate(
        **inputs,
        streamer=streamer,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        do_sample=temperature > 0,
        pad_token_id=tokenizer.eos_token_id,
    )


def _tokenize(tokenizer, messages: list[dict], device) -> dict:
    try:
        prompt = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
    except Exception:
        prompt = (
            "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
            + "\nASSISTANT:"
        )
    inputs = tokenizer(prompt, return_tensors="pt")
    return {k: v.to(device) for k, v in inputs.items()}


async def _stream_final_answer(
    messages: list[dict],
    max_new_tokens: int,
    temperature: float,
) -> AsyncGenerator[str, None]:
    """Stream the final answer token-by-token (no tool call expected)."""
    model = loaded_model.get("model")
    tokenizer = loaded_model.get("tokenizer")
    device = next(model.parameters()).device

    inputs = _tokenize(tokenizer, messages, device)
    streamer = TextIteratorStreamer(
        tokenizer, skip_prompt=True, skip_special_tokens=True
    )
    thread = threading.Thread(
        target=_run_generation,
        args=(model, tokenizer, inputs, streamer, max_new_tokens, temperature),
    )
    thread.start()

    inside_think = False
    for token in streamer:
        if "<think>" in token:
            inside_think = True
        if inside_think:
            if "</think>" in token:
                inside_think = False
            continue
        yield json.dumps({"token": token})

    thread.join()


# ── main entry point ───────────────────────────────────────────────────────────

async def agentic_stream(
    messages: list[dict],
    max_new_tokens: int = 512,
    temperature: float = 0.7,
    max_tool_calls: int = 3,
) -> AsyncGenerator[str, None]:
    """
    Main agentic streaming generator.

    Yields SSE-compatible JSON events:
      {"token": "..."}                          — response text
      {"status": "...", "tool_call": {...}, "routing": {...}}  — tool executing
      {"done": true}                            — stream finished
      {"error": "..."}                          — something went wrong
    """
    # Enforce minimum token budget for reasoning models
    max_new_tokens = max(max_new_tokens, 512)

    model = loaded_model.get("model")
    tokenizer = loaded_model.get("tokenizer")

    if not model or not tokenizer:
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

        print(f"[agent] raw_result: {raw_result[:500]}")      # ← add
        print(f"[agent] compact_result: {compact_result[:500]}") 

        answer_messages = [
            {"role": "system", "content": FINAL_ANSWER_SYSTEM_PROMPT},
            *messages[-4:],
            {"role": "user", "content": format_tool_result(selection.tool_name, compact_result)},
        ]
        async for event in _stream_final_answer(answer_messages, max_new_tokens, 0.2):
            yield event

        yield json.dumps({"done": True})
        return

    # ── Path 2: model-driven fallback ──────────────────────────────────────────
    device = next(model.parameters()).device
    tools_text = format_tools_for_prompt(tools)
    system_prompt = build_system_prompt(tools_text)
    full_messages = [{"role": "system", "content": system_prompt}, *messages]

    tool_calls_made = 0
    max_calls = min(max_tool_calls, settings.AI_MAX_TOOL_CALLS)

    while tool_calls_made <= max_calls:
        is_first_pass = tool_calls_made == 0

        inputs = _tokenize(tokenizer, full_messages, device)
        streamer = TextIteratorStreamer(
            tokenizer, skip_prompt=True, skip_special_tokens=True
        )
        thread = threading.Thread(
            target=_run_generation,
            args=(model, tokenizer, inputs, streamer, max_new_tokens, temperature),
        )
        thread.start()

        collected = []
        inside_think = False

        for token in streamer:
            collected.append(token)
            full_so_far = "".join(collected)

            # Track <think> blocks (reasoning models like SmolLM3)
            if "<think>" in full_so_far:
                inside_think = True
            if "</think>" in full_so_far:
                inside_think = False
                continue
            if inside_think:
                continue

            # Early-exit if a complete tool call has appeared
            has_xml = "<tool_call>" in full_so_far and "</tool_call>" in full_so_far
            has_md = (
                "```" in full_so_far
                and full_so_far.count("```") >= 2
                and '"tool"' in full_so_far
            )
            if has_xml or has_md:
                break

            # First pass: always buffer — we don't know yet if this is a tool call.
            # Subsequent passes: stream freely — this is the final answer.
            if not is_first_pass:
                yield json.dumps({"token": token})

        thread.join()
        full_output = "".join(collected)

        # ── No tool call ───────────────────────────────────────────────────────
        parsed = extract_tool_call(full_output)
        if not parsed:
            if is_first_pass:
                # Buffer was never streamed — strip fences and yield whole answer
                remaining = strip_tool_call(full_output)
                if remaining:
                    yield json.dumps({"token": remaining})
            # Final answer pass already streamed token-by-token above
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

        # Inject tool result and loop for final answer
        full_messages.append({"role": "assistant", "content": full_output})
        full_messages.append({
            "role": "user",
            "content": format_tool_result(tool_name, compact_result),
        })

    yield json.dumps({"done": True})