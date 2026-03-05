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
    "Use ONLY the tool result provided in the conversation. "
    "If the answer is missing, say you do not have enough data from the tool result. "
    "Do not invent records, counts, dates, or IDs. "
    "Prefer short factual answers."
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
   - Report EXACTLY what the data says. Do not add warnings, caveats, or \
conclusions that are not in the data.
   - If the result is empty, say "No records found matching your query."
   - If the result contains an error, report it directly.
   - Use a markdown table when the result contains multiple records.
   - Do NOT say things like "there seems to be an issue" unless the tool \
explicitly returned an error.

5. If no tool is needed, answer from general medical/lab knowledge.

6. Dates: ISO format YYYY-MM-DD. Default limit: 20 unless user specifies.

7. Never wrap your final answer in markdown code blocks or backticks. Plain text only.

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


def format_tool_result(tool_name: str, result: str) -> str:
    """Strict fill-in template - leaves as little room for hallucination as possible."""
    return (
        f"<tool_result tool=\"{tool_name}\">\n"
        f"{result}\n"
        f"</tool_result>\n\n"
        f"INSTRUCTION: Answer using ONLY the tool_result above. "
        f"If the answer is missing, say: I do not have enough data from the tool result. "
        f"Copy values directly when available. "
        f"Do not invent rows, counts, dates, IDs, or conclusions.\n\n"
        f"Answer: "
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
