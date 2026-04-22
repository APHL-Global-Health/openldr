"""
Inference service - generates responses using the loaded llama-cpp-python model.
Supports both streaming (SSE) and non-streaming responses.
"""
from typing import AsyncGenerator

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
    Yields tokens one by one using llama-cpp-python's streaming chat completion.
    """
    llm = loaded_model.get("model")
    if not llm:
        yield "[ERROR: No model loaded]"
        return

    response = llm.create_chat_completion(
        messages=messages,
        max_tokens=max_new_tokens,
        temperature=temperature,
        stream=True,
    )

    for chunk in response:
        delta = chunk.get("choices", [{}])[0].get("delta", {})
        token = delta.get("content")
        if token:
            yield token


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
