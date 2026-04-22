from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.config import settings


@dataclass
class BudgetedPrompt:
    prompt: str
    token_count: int
    trimmed_messages: list[dict[str, str]]


def render_chat_prompt(tokenizer, messages: list[dict[str, str]]) -> str:
    try:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception:
        return "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages) + "\nASSISTANT:"


def count_tokens(tokenizer, text: str) -> int:
    return len(tokenizer(text, add_special_tokens=False)["input_ids"])


def trim_text_to_token_budget(tokenizer, text: str, max_tokens: int) -> str:
    if max_tokens <= 0:
        return ""

    input_ids = tokenizer(text, add_special_tokens=False)["input_ids"]
    if len(input_ids) <= max_tokens:
        return text

    trimmed_ids = input_ids[-max_tokens:]
    return tokenizer.decode(trimmed_ids, skip_special_tokens=True)


def compact_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    if not messages:
        return []

    system_messages = [m for m in messages if m.get("role") == "system"]
    other_messages = [m for m in messages if m.get("role") != "system"]

    max_history = max(1, settings.AI_MAX_HISTORY_MESSAGES)
    trimmed = other_messages[-max_history:]
    return [*system_messages[-1:], *trimmed] if system_messages else trimmed


def build_budgeted_prompt(
    tokenizer,
    messages: list[dict[str, str]],
    max_input_tokens: int | None = None,
    reserved_output_tokens: int | None = None,
    safety_margin_tokens: int | None = None,
) -> BudgetedPrompt:
    max_input_tokens = max_input_tokens or settings.AI_MAX_INPUT_TOKENS
    reserved_output_tokens = reserved_output_tokens or settings.AI_RESERVED_OUTPUT_TOKENS
    safety_margin_tokens = safety_margin_tokens or settings.AI_CONTEXT_SAFETY_MARGIN_TOKENS

    effective_budget = max(512, max_input_tokens - reserved_output_tokens - safety_margin_tokens)

    working = compact_messages(messages)

    while working:
        prompt = render_chat_prompt(tokenizer, working)
        token_count = count_tokens(tokenizer, prompt)
        if token_count <= effective_budget:
            return BudgetedPrompt(prompt=prompt, token_count=token_count, trimmed_messages=working)

        non_system_indexes = [i for i, m in enumerate(working) if m.get("role") != "system"]
        if len(non_system_indexes) > 1:
            del working[non_system_indexes[0]]
            continue

        # Last resort: trim the final non-system message content itself.
        target_index = non_system_indexes[0] if non_system_indexes else len(working) - 1
        keep_budget = max(128, effective_budget // max(1, len(working)))
        content = working[target_index].get("content", "")
        working[target_index] = {
            **working[target_index],
            "content": trim_text_to_token_budget(tokenizer, content, keep_budget),
        }

        prompt = render_chat_prompt(tokenizer, working)
        token_count = count_tokens(tokenizer, prompt)
        if token_count <= effective_budget:
            return BudgetedPrompt(prompt=prompt, token_count=token_count, trimmed_messages=working)

        if len(working) == 1:
            break

    prompt = render_chat_prompt(tokenizer, working[:1] if working else messages[-1:])
    return BudgetedPrompt(
        prompt=prompt,
        token_count=count_tokens(tokenizer, prompt),
        trimmed_messages=working[:1] if working else messages[-1:],
    )


def tokenize_budgeted_prompt(tokenizer, prompt: str, device) -> dict[str, Any]:
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True)
    return {k: v.to(device) for k, v in inputs.items()}
