"""
Agentic inference service
--------------------------
Wraps the base TextIteratorStreamer with a tool-use loop:

1. First pass: generate until model outputs <tool_call> or finishes
2. If tool call detected: execute it via MCP, inject result, generate again
3. Stream final answer tokens to client

The client-facing SSE stream stays open throughout — the user sees a
"Querying data..." indicator while the tool executes, then tokens flow.
"""
import json
import threading
from typing import AsyncGenerator

from transformers import TextIteratorStreamer
import torch

from core.state import loaded_model
from services.mcp_client import fetch_tools, execute_tool, format_tools_for_prompt
from services.tool_prompt import (
    build_system_prompt,
    extract_tool_call,
    format_tool_result,
    strip_tool_call,
)


def _run_generation(model, tokenizer, inputs, streamer, max_new_tokens, temperature):
    """Run model.generate in a background thread."""
    generation_kwargs = {
        **inputs,
        "streamer": streamer,
        "max_new_tokens": max_new_tokens,
        "temperature": temperature,
        "do_sample": temperature > 0,
        "pad_token_id": tokenizer.eos_token_id,
    }
    model.generate(**generation_kwargs)


def _tokenize(tokenizer, messages: list[dict], device) -> dict:
    """Apply chat template and tokenize."""
    try:
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception:
        prompt = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in messages
        ) + "\nASSISTANT:"

    inputs = tokenizer(prompt, return_tensors="pt")
    return {k: v.to(device) for k, v in inputs.items()}


async def agentic_stream(
    messages: list[dict],
    max_new_tokens: int = 512,
    temperature: float = 0.7,
    max_tool_calls: int = 3,
) -> AsyncGenerator[str, None]:
    """
    Main agentic streaming generator.

    Yields SSE-compatible events:
    - {"token": "..."} — regular text token
    - {"status": "..."} — status update (tool executing)
    - {"tool_call": {"tool": ..., "args": ...}} — tool being called (for UI)
    - {"done": true} — stream finished
    - {"error": "..."} — error occurred
    """
    model = loaded_model.get("model")
    tokenizer = loaded_model.get("tokenizer")

    if not model or not tokenizer:
        yield '{"error": "No model loaded"}'
        return

    device = next(model.parameters()).device

    # Fetch tools and build system prompt
    tools = await fetch_tools()
    tools_text = format_tools_for_prompt(tools)
    system_prompt = build_system_prompt(tools_text)

    # Build full message list with system prompt prepended
    full_messages = [
        {"role": "system", "content": system_prompt},
        *messages,
    ]

    tool_calls_made = 0

    while tool_calls_made <= max_tool_calls:
        # ── Generation pass ────────────────────────────────────────────────
        inputs = _tokenize(tokenizer, full_messages, device)

        streamer = TextIteratorStreamer(
            tokenizer,
            skip_prompt=True,
            skip_special_tokens=True,
        )

        thread = threading.Thread(
            target=_run_generation,
            args=(model, tokenizer, inputs, streamer, max_new_tokens, temperature),
        )
        thread.start()

        # Collect tokens, watch for tool call
        collected = []
        tool_call_detected = False

        for token in streamer:
            collected.append(token)
            full_so_far = "".join(collected)

            # Check if a complete tool call has appeared in any supported format
            has_xml = "<tool_call>" in full_so_far and "</tool_call>" in full_so_far
            has_md = "```" in full_so_far and full_so_far.count("```") >= 2 and '"tool"' in full_so_far
            if has_xml or has_md:
                tool_call_detected = True
                break

            # Stream token to client only if no tool call is building up
            building_xml = "<tool_call>" in full_so_far and "</tool_call>" not in full_so_far
            building_md = full_so_far.count("```") == 1 and '"tool"' in full_so_far
            if not building_xml and not building_md:
                yield json.dumps({"token": token})

        thread.join()
        full_output = "".join(collected)

        if not tool_call_detected:
            # No tool call — stream whatever wasn't sent yet and finish
            # (handles edge case where tool call never completed)
            remaining = strip_tool_call(full_output)
            already_sent = "".join(
                t for t in collected
                if "<tool_call>" not in "".join(collected[:collected.index(t) + 1])
            )
            if remaining and remaining not in already_sent:
                yield json.dumps({"token": remaining})
            break

        # ── Tool call detected ─────────────────────────────────────────────
        parsed = extract_tool_call(full_output)

        if not parsed:
            # Malformed tool call - stream the raw output and stop
            yield json.dumps({"token": strip_tool_call(full_output)})
            break

        tool_name, tool_args = parsed
        tool_calls_made += 1

        # Notify frontend a tool is executing
        yield json.dumps({
            "status": f"Querying {tool_name}...",
            "tool_call": {"tool": tool_name, "args": tool_args},
        })

        # Execute the tool via MCP
        try:
            tool_result = await execute_tool(tool_name, tool_args)
        except Exception as e:
            tool_result = f"Tool execution failed: {str(e)}"

        # Inject the assistant's tool call + result back into conversation
        full_messages.append({
            "role": "assistant",
            "content": full_output,
        })
        full_messages.append({
            "role": "user",
            "content": format_tool_result(tool_name, tool_result),
        })

        # Loop: model will now generate the final answer using tool result

    yield json.dumps({"done": True})
# DEBUG PATCH - temporary, add print statements to see tool results
