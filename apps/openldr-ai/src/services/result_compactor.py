from __future__ import annotations

import json
from typing import Any

from core.config import settings


MAX_LIST_ITEMS = 8
MAX_TEXT_LINES = 24


def _truncate_text(value: str, max_chars: int) -> str:
    value = value.strip()
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3].rstrip() + "..."


def _compact_json_value(value: Any, depth: int = 0) -> Any:
    if depth > 2:
        return "[truncated]"

    if isinstance(value, dict):
        compact: dict[str, Any] = {}
        for i, (k, v) in enumerate(value.items()):
            if i >= 20:
                compact["_truncated_keys"] = max(0, len(value) - 20)
                break
            compact[k] = _compact_json_value(v, depth + 1)
        return compact

    if isinstance(value, list):
        preview = [_compact_json_value(v, depth + 1) for v in value[:MAX_LIST_ITEMS]]
        if len(value) > MAX_LIST_ITEMS:
            preview.append({"_truncated_items": len(value) - MAX_LIST_ITEMS})
        return preview

    if isinstance(value, str):
        return _truncate_text(value, 200)

    return value


def compact_tool_result(tool_name: str, result: str) -> str:
    raw = (result or "").strip()
    if not raw:
        return json.dumps({"tool": tool_name, "summary": "No data returned."}, indent=2)

    try:
        parsed = json.loads(raw)

        # Single object — return as-is, never compact
        if isinstance(parsed, dict):
            return raw

        # Array — compact if large
        if isinstance(parsed, list):
            if len(parsed) <= 10:
                return raw
            compact = {
                "tool": tool_name,
                "total": len(parsed),
                "showing": 10,
                "results": parsed[:10],
            }
            rendered = json.dumps(compact, indent=2, ensure_ascii=False)
            return _truncate_text(rendered, settings.AI_TOOL_RESULT_CHAR_LIMIT)

    except Exception:
        pass

    # Plain text fallback
    lines = [line.rstrip() for line in raw.splitlines() if line.strip()]
    compact_lines = lines[:MAX_TEXT_LINES]
    text = "\n".join(compact_lines)
    if len(lines) > MAX_TEXT_LINES:
        text += f"\n... ({len(lines) - MAX_TEXT_LINES} more lines omitted)"
    return _truncate_text(text, settings.AI_TOOL_RESULT_CHAR_LIMIT)
