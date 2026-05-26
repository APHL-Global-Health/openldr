"""
Tool-use prompt engineering for small local models.
"""
import json
import re
from typing import Optional

THINK_PATTERN = re.compile(r"<think>.*?</think>", re.DOTALL)

def strip_thinking(text: str) -> str:
    return THINK_PATTERN.sub("", text).strip()



FINAL_ANSWER_SYSTEM_PROMPT = (
    "You are answering a user with evidence returned from OpenLDR tools. "
    "Use ONLY the tool result provided in the conversation.\n\n"
    "## CRITICAL: No hallucination\n"
    "- If the tool result is empty or missing data, say: \"No data found.\"\n"
    "- NEVER invent records, counts, dates, IDs, names, or values.\n"
    "- NEVER guess what the data might be — only report what is in the tool result.\n"
    "- Copy values exactly as they appear in the tool result.\n\n"
    "## Formatting rules (use rich markdown)\n"
    "- **Tables**: When the result contains 2+ records, ALWAYS use a markdown table.\n"
    "- **Headings**: Start with a short `##` heading summarizing the result.\n"
    "- **Bold**: Use **bold** for status values, key fields, and labels.\n"
    "- **Code**: Use `inline code` for UUIDs, file paths, IDs, and technical values.\n"
    "- **Lists**: Use bullet lists for key-value summaries of single records.\n"
    "- **Status indicators**: Use bold for statuses — **completed**, **failed**, **running**.\n"
    "- **Counts**: When showing totals, use bold numbers — **7 runs found**.\n"
    "- Keep answers concise — heading + table/list + 1 sentence summary.\n"
)


SYSTEM_PROMPT_TEMPLATE = """\
You are an AI assistant embedded in OpenLDR, an open-source Laboratory \
Information Management System for antimicrobial resistance (AMR) surveillance \
and data processing.

You help laboratory staff query live data, track test requests and results, \
and monitor system health.

## Available tools
{tools}

## STRICT tool usage rules
1. Use EXACTLY this format — no markdown, no code blocks, no backticks, no extra text:
<tool_call>
{{"tool": "tool_name", "args": {{"param": "value"}}}}
</tool_call>

WRONG - never do this:
```json
{{"tool": "...", "args": {{}}}}
```
WRONG - never do this:
{{"tool": "...", "args": {{}}}}

CORRECT - always use <tool_call> tags exactly as shown above.

2. ONLY include args that the user explicitly mentioned. Do NOT invent or \
assume filter values like status, test_type, patient_id unless the user said so.
   - "show me last 5 results" → args: {{"limit": 5}}
   - "show me last 5 results" → args: {{"limit": 5, "status": "complete", "test_type": "blood"}}  ✗ WRONG

3. Call only ONE tool per turn.

4. After receiving <tool_result>:
   - Report EXACTLY what the data says. NEVER invent data.
   - If the result is empty, say "No records found."
   - If the result contains an error, report it directly.
   - Do NOT add warnings, caveats, or conclusions not in the data.

5. If the user asks something that requires data you don't have and no tool \
can provide it, say: "I don't have that information. Here are the tools I \
can use: [list relevant tools]." Do NOT make up an answer.

6. If no tool is needed, answer from general medical/lab knowledge.

7. Dates: ISO format YYYY-MM-DD. Default limit: 20 unless user specifies.

## Response formatting (rich markdown)
- **Headings**: Start responses with a `##` heading summarizing the answer.
- **Tables**: ALWAYS use a markdown table when showing 2+ records.
- **Bold**: Use **bold** for status values, key fields, and important labels.
- **Code**: Use `inline code` for UUIDs, file paths, IDs, and technical values.
- **Lists**: Use bullet lists for single-record key-value summaries.
- **Code blocks**: Use fenced code blocks (```json) for raw JSON or config data.
- **Status**: Show statuses as bold — **completed**, **failed**, **running**.
- Keep answers concise — heading + data + 1 sentence summary.

Today: {today}
System: OpenLDR v{version}
"""


def build_system_prompt(tools_text: str, version: str = "0.1.0") -> str:
    from datetime import date
    return SYSTEM_PROMPT_TEMPLATE.format(
        tools=tools_text,
        today=date.today().isoformat(),
        version=version,
    )


# Primary pattern: <tool_call> tags (correct format)
TOOL_CALL_PATTERN = re.compile(
    r"<tool_call>\s*(\{.*?\})\s*</tool_call>",
    re.DOTALL,
)

# Fallback pattern: ```json blocks (small models often use this despite instructions)
TOOL_CALL_MARKDOWN_PATTERN = re.compile(
    r'```(?:json)?\s*(\{[^`]*?[\'"]tool[\'"][^`]*?\})\s*```',
    re.DOTALL,
)

# Fallback pattern: bare JSON with "tool" key (no wrapper at all)
TOOL_CALL_BARE_PATTERN = re.compile(
    r'(?:^|\n)(\{\s*["\']tool["\']\s*:.*?\})(?:\s*$|\n)',
    re.DOTALL,
)


def _parse_tool_json(raw_json: str) -> Optional[tuple[str, dict]]:
    """Parse and validate a raw JSON string as a tool call."""
    raw_json = raw_json.strip()
    raw_json = raw_json.replace("\'", '"')
    raw_json = re.sub(r",\s*([}\]])", r"\1", raw_json)
    try:
        parsed = json.loads(raw_json)
        tool_name = (
            parsed.get("tool")
            or parsed.get("name")
            or parsed.get("function")
        )
        args = (
            parsed.get("args")
            or parsed.get("arguments")
            or parsed.get("parameters")
            or {}
        )
        if not tool_name:
            return None
        return tool_name, args
    except json.JSONDecodeError:
        return None


def extract_tool_call(text: str) -> Optional[tuple[str, dict]]:
    """
    Parse a tool call from model output.
    Tries three patterns in order of preference:
    1. <tool_call>{...}</tool_call>  (correct)
    2. ```json {...} ```             (small model fallback)
    3. bare {...} with "tool" key   (last resort)
    """
    # Try primary format first
    text = strip_thinking(text)  # ← add this
    match = TOOL_CALL_PATTERN.search(text)
    if match:
        result = _parse_tool_json(match.group(1))
        if result:
            return result

    # Try markdown code block fallback
    match = TOOL_CALL_MARKDOWN_PATTERN.search(text)
    if match:
        result = _parse_tool_json(match.group(1))
        if result:
            return result

    # Try bare JSON fallback
    match = TOOL_CALL_BARE_PATTERN.search(text)
    if match:
        result = _parse_tool_json(match.group(1))
        if result:
            return result

    return None


def _detect_format_hint(tool_name: str, result: str) -> str:
    """Detect the shape of tool result data and return a formatting hint."""
    try:
        parsed = json.loads(result)
    except (json.JSONDecodeError, TypeError):
        return ""

    # Array of records → markdown table
    if isinstance(parsed, list) and len(parsed) >= 2 and isinstance(parsed[0], dict):
        cols = list(parsed[0].keys())[:8]
        return (
            f"Format as a markdown table. Use these columns: {', '.join(cols)}. "
            f"Use `inline code` for IDs and UUIDs. Use **bold** for status values. "
        )

    # Single dict with nested data → structured list
    if isinstance(parsed, dict):
        keys = list(parsed.keys())
        # Health check style — flat key-value
        if all(not isinstance(parsed[k], (dict, list)) for k in keys):
            return (
                "Format as a bullet list with **bold labels** and values. "
                "Use a `##` heading. "
            )
        # Complex object with nested fields
        return (
            "Format as a structured summary with `##` heading. "
            "Use bullet lists for key-value pairs. "
            "Use **bold** for labels and `inline code` for technical values. "
            "For nested arrays, use a markdown table if they contain 2+ items. "
        )

    # Wrapped result with total/showing
    if isinstance(parsed, dict) and "total" in parsed and "results" in parsed:
        return (
            f"Format the {parsed['total']} records as a markdown table. "
            f"Mention showing {parsed.get('showing', '?')} of {parsed['total']} total. "
        )

    return ""


def format_tool_result(tool_name: str, result: str) -> str:
    """Strict fill-in template - leaves as little room for hallucination as possible."""
    format_hint = _detect_format_hint(tool_name, result)
    return (
        f"<tool_result tool=\"{tool_name}\">\n"
        f"{result}\n"
        f"</tool_result>\n\n"
        f"INSTRUCTION: Answer using ONLY the data in the tool_result above.\n"
        f"{format_hint}"
        f"NEVER invent records, counts, dates, IDs, or values not present in the result.\n"
        f"If the result is empty or missing data, say: \"No data found.\"\n"
        f"Copy values exactly as they appear.\n\n"
        f"Answer:\n"
    )

CODE_FENCE_PATTERN = re.compile(r"^```(?:\w+)?\n?(.*?)```$", re.DOTALL)

def strip_tool_call(text: str) -> str:
    """Remove <tool_call> block from text."""
    text = strip_thinking(text)
    text = TOOL_CALL_PATTERN.sub("", text).strip()
    # Strip markdown code fences
    match = CODE_FENCE_PATTERN.match(text)
    if match:
        text = match.group(1).strip()
    return text
