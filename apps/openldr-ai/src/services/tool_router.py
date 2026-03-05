from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any


WORD_RE = re.compile(r"[a-zA-Z0-9_]+")
DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
INTEGER_RE = re.compile(r"\b\d+\b")


@dataclass
class ToolSelection:
    should_call_tool: bool
    tool_name: str | None = None
    args: dict[str, Any] | None = None
    confidence: float = 0.0
    reason: str = ""
    missing_required: list[str] | None = None


GENERIC_CHAT_KEYWORDS = {
    "what",
    "why",
    "how",
    "explain",
    "difference",
    "meaning",
    "define",
    "overview",
}


TOOLISH_KEYWORDS = {
    "show",
    "list",
    "find",
    "count",
    "latest",
    "recent",
    "today",
    "yesterday",
    "status",
    "result",
    "results",
    "lab",
    "patient",
    "sample",
    "specimen",
    "upload",
    "facility",
    "dashboard",
}


STOPWORDS = {
    "the", "a", "an", "to", "for", "and", "or", "of", "me", "my", "is", "are", "in", "on", "with",
    "please", "show", "get", "give", "tell", "from", "last", "this", "that", "be", "as", "at",
}


BOOLEAN_TRUE = {"true", "yes", "enabled", "active", "healthy", "up"}
BOOLEAN_FALSE = {"false", "no", "disabled", "inactive", "unhealthy", "down"}


def tokenize_words(text: str) -> set[str]:
    return {w.lower() for w in WORD_RE.findall(text) if len(w) > 1 and w.lower() not in STOPWORDS}


def question_likely_needs_tool(user_text: str) -> bool:
    lowered = user_text.lower()
    words = tokenize_words(lowered)
    if any(k in lowered for k in TOOLISH_KEYWORDS):
        return True
    if any(k in words for k in {"count", "latest", "status", "results", "patient", "lab", "facility"}):
        return True
    if words & GENERIC_CHAT_KEYWORDS and not words & TOOLISH_KEYWORDS:
        return False
    return any(ch.isdigit() for ch in user_text)


def _score_tool(tool: dict[str, Any], user_text: str) -> float:
    question_words = tokenize_words(user_text)
    name_words = tokenize_words(tool.get("name", "").replace("_", " "))
    desc_words = tokenize_words(tool.get("description", ""))
    param_words = tokenize_words(" ".join((tool.get("inputSchema", {}) or {}).get("properties", {}).keys()))

    score = 0.0
    score += len(question_words & name_words) * 3.0
    score += len(question_words & desc_words) * 1.5
    score += len(question_words & param_words) * 1.0

    if any(token in tool.get("name", "").lower() for token in ["search", "find", "list"]) and any(
        token in user_text.lower() for token in ["show", "list", "find"]
    ):
        score += 1.5
    if "count" in user_text.lower() and "count" in tool.get("name", "").lower():
        score += 2.0
    if "status" in user_text.lower() and "status" in tool.get("name", "").lower():
        score += 2.0

    return score


def _extract_string_param(user_text: str, param_name: str) -> str | None:
    lowered = user_text.lower()
    pname = param_name.lower()

    quoted = re.findall(r'"([^"]+)"|\'([^\']+)\'', user_text)
    flattened = [a or b for a, b in quoted if (a or b)]
    if flattened and any(tag in pname for tag in ["id", "name", "code", "status", "type"]):
        return flattened[0]

    patterns = [
        rf"{re.escape(pname)}\s+(?:is|=|:)?\s*([a-zA-Z0-9_\-]+)",
        rf"(?:for|with)\s+{re.escape(pname)}\s+([a-zA-Z0-9_\-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, lowered)
        if match:
            return match.group(1)

    if pname in {"query", "search", "term", "text"}:
        return user_text.strip()

    return None


def _extract_date_value(user_text: str, param_name: str) -> str | None:
    lowered = user_text.lower()
    explicit_dates = DATE_RE.findall(user_text)
    today = date.today()

    if explicit_dates:
        if param_name.lower() in {"from_date", "start_date", "date_from", "start"}:
            return explicit_dates[0]
        if param_name.lower() in {"to_date", "end_date", "date_to", "end"}:
            return explicit_dates[-1]
        return explicit_dates[0]

    if "today" in lowered:
        return today.isoformat()
    if "yesterday" in lowered:
        return (today - timedelta(days=1)).isoformat()
    if "this week" in lowered and param_name.lower() in {"from_date", "start_date", "date_from", "start"}:
        return (today - timedelta(days=today.weekday())).isoformat()
    if "this week" in lowered and param_name.lower() in {"to_date", "end_date", "date_to", "end"}:
        return today.isoformat()

    return None


def _extract_integer_value(user_text: str, param_name: str) -> int | None:
    lowered = user_text.lower()
    pname = param_name.lower()

    if pname == "limit":
        patterns = [r"(?:last|latest|top|first)\s+(\d+)", rf"{re.escape(pname)}\s*(?:is|=|:)?\s*(\d+)"]
        for pattern in patterns:
            match = re.search(pattern, lowered)
            if match:
                return int(match.group(1))

    match = re.search(rf"{re.escape(pname)}\s*(?:is|=|:)?\s*(\d+)", lowered)
    if match:
        return int(match.group(1))

    ints = [int(x) for x in INTEGER_RE.findall(user_text)]
    if len(ints) == 1 and pname in {"limit", "page", "offset", "count", "days"}:
        return ints[0]
    return None


def _extract_boolean_value(user_text: str, param_name: str) -> bool | None:
    lowered = user_text.lower()
    pname = param_name.lower()
    for token in BOOLEAN_TRUE:
        if f"{pname} {token}" in lowered or f"{pname} is {token}" in lowered:
            return True
    for token in BOOLEAN_FALSE:
        if f"{pname} {token}" in lowered or f"{pname} is {token}" in lowered:
            return False
    return None


def extract_args_from_text(user_text: str, tool: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    schema = tool.get("inputSchema", {}) or {}
    props = schema.get("properties", {}) or {}
    required = schema.get("required", []) or []

    args: dict[str, Any] = {}
    missing_required: list[str] = []

    for param_name, pinfo in props.items():
        ptype = (pinfo.get("type") or "string").lower()
        value = None

        if ptype in {"integer", "number"}:
            value = _extract_integer_value(user_text, param_name)
        elif ptype == "boolean":
            value = _extract_boolean_value(user_text, param_name)
        else:
            if "date" in param_name.lower() or param_name.lower() in {"start", "end"}:
                value = _extract_date_value(user_text, param_name)
            if value is None:
                value = _extract_string_param(user_text, param_name)

        if value is not None:
            args[param_name] = value
        elif param_name in required:
            missing_required.append(param_name)

    return args, missing_required


def select_tool_for_query(user_text: str, tools: list[dict[str, Any]]) -> ToolSelection:
    if not tools or not question_likely_needs_tool(user_text):
        return ToolSelection(False, reason="Question does not strongly look like a live-data request.")

    scored = sorted(((tool, _score_tool(tool, user_text)) for tool in tools), key=lambda item: item[1], reverse=True)
    if not scored or scored[0][1] < 2.0:
        return ToolSelection(False, reason="No MCP tool matched the question strongly enough.")

    best_tool, confidence = scored[0]
    args, missing_required = extract_args_from_text(user_text, best_tool)

    if missing_required:
        return ToolSelection(
            should_call_tool=False,
            tool_name=best_tool.get("name"),
            args=args,
            confidence=confidence,
            reason="Best-matching tool still needs required arguments we could not safely infer.",
            missing_required=missing_required,
        )

    return ToolSelection(
        should_call_tool=True,
        tool_name=best_tool.get("name"),
        args=args,
        confidence=confidence,
        reason="Deterministic tool router matched the question to an MCP tool.",
        missing_required=[],
    )
