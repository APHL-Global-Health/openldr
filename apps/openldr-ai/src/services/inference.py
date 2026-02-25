"""
Inference service - generates responses using the loaded model.
Supports both streaming (SSE) and non-streaming responses.
"""
import threading
from typing import AsyncGenerator

from transformers import TextIteratorStreamer
import torch

from core.state import loaded_model


def is_model_loaded() -> bool:
    return bool(loaded_model.get("model"))


def get_loaded_model_id() -> str | None:
    return loaded_model.get("model_id")


async def generate_stream(
    messages: list[dict],
    max_new_tokens: int = 512,
    temperature: float = 0.7,
) -> AsyncGenerator[str, None]:
    """
    Yields tokens one by one as they are generated.
    Uses TextIteratorStreamer so generation runs in a separate thread
    while we iterate the results asynchronously.
    """
    model = loaded_model.get("model")
    tokenizer = loaded_model.get("tokenizer")

    if not model or not tokenizer:
        yield "[ERROR: No model loaded]"
        return

    # Apply chat template if available (most instruct models have one)
    try:
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception:
        # Fallback: simple concatenation for models without chat template
        prompt = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in messages
        ) + "\nASSISTANT:"

    inputs = tokenizer(prompt, return_tensors="pt")

    # Move inputs to same device as model
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}

    streamer = TextIteratorStreamer(
        tokenizer,
        skip_prompt=True,
        skip_special_tokens=True,
    )

    generation_kwargs = {
        **inputs,
        "streamer": streamer,
        "max_new_tokens": max_new_tokens,
        "temperature": temperature,
        "do_sample": temperature > 0,
        "pad_token_id": tokenizer.eos_token_id,
    }

    # Run generation in background thread
    thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    # Yield tokens as they come in
    for token in streamer:
        yield token

    thread.join()


async def generate(
    messages: list[dict],
    max_new_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """Non-streaming version - collects the full response."""
    result = []
    async for token in generate_stream(messages, max_new_tokens, temperature):
        result.append(token)
    return "".join(result)
