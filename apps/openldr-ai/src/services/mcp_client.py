"""
MCP Client Service — Streamable HTTP Transport
-----------------------------------------------
Your MCP server uses StreamableHTTPServerTransport (POST+GET /stream).

Protocol per request:
1. POST /stream (no session ID)  → initialize → get mcp-session-id from header
2. POST /stream (with session ID) → send JSON-RPC method → read SSE response body
"""
import json
import httpx
from typing import Any
from core.config import settings

_tools_cache: list[dict] = []
_tools_fetched = False


def _parse_sse_body(text: str) -> dict | None:
    """Extract first JSON-RPC result from an SSE response body."""
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            payload = line[5:].strip()
            if not payload or payload == "[DONE]":
                continue
            try:
                return json.loads(payload)
            except json.JSONDecodeError:
                continue
    return None


async def _mcp_request(method: str, params: dict, timeout: float = 30.0) -> dict:
    """
    Open a fresh MCP session, send one JSON-RPC request, return the result.
    Each call goes through the full initialize → request → close cycle.
    """
    async with httpx.AsyncClient(timeout=timeout) as client:

        # ── 1. Initialize session ──────────────────────────────────────────
        init_resp = await client.post(
            f"{settings.AI_MCP_URL}/stream",
            json={
                "jsonrpc": "2.0",
                "id": 0,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "openldr-ai", "version": "0.1.0"},
                },
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
        )
        init_resp.raise_for_status()

        # Session ID comes back in the response header
        session_id = init_resp.headers.get("mcp-session-id")
        if not session_id:
            raise RuntimeError(
                "MCP server returned no mcp-session-id header. "
                f"Status: {init_resp.status_code}, Body: {init_resp.text[:300]}"
            )

        # ── 2. Send initialized notification (MCP protocol requires this) ──
        await client.post(
            f"{settings.AI_MCP_URL}/stream",
            json={
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "mcp-session-id": session_id,
            },
        )

        # ── 3. Send actual request ─────────────────────────────────────────
        resp = await client.post(
            f"{settings.AI_MCP_URL}/stream",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": params,
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "mcp-session-id": session_id,
            },
        )
        resp.raise_for_status()

        # ── 4. Parse SSE response body ─────────────────────────────────────
        parsed = _parse_sse_body(resp.text)
        if not parsed:
            raise RuntimeError(
                f"Empty/unparseable SSE response for '{method}': {resp.text[:300]}"
            )
        if "error" in parsed:
            raise RuntimeError(f"MCP error ({method}): {parsed['error']}")

        return parsed.get("result", {})


async def fetch_tools() -> list[dict]:
    """Fetch and cache the tool list from the MCP server."""
    global _tools_cache, _tools_fetched

    if _tools_fetched and _tools_cache:
        return _tools_cache

    try:
        result = await _mcp_request("tools/list", {}, timeout=15.0)
        _tools_cache = result.get("tools", [])
        _tools_fetched = True
        print(f"[mcp] Loaded {len(_tools_cache)} tools: "
              f"{[t['name'] for t in _tools_cache]}")
    except Exception as e:
        print(f"[mcp] Failed to fetch tools: {e}")
        _tools_cache = []

    return _tools_cache


async def execute_tool(tool_name: str, arguments: dict[str, Any]) -> str:
    """Execute an MCP tool and return the result as plain text."""
    try:
        result = await _mcp_request(
            "tools/call",
            {"name": tool_name, "arguments": arguments},
            timeout=45.0,
        )

        content_blocks = result.get("content", [])
        if content_blocks:
            parts = [
                b.get("text", "")
                for b in content_blocks
                if b.get("type") == "text"
            ]
            text = "\n".join(filter(None, parts))
        else:
            text = json.dumps(result, indent=2)

        if result.get("isError"):
            return f"Tool error: {text}"

        return text or "(no data returned)"

    except httpx.TimeoutException:
        return f"Tool '{tool_name}' timed out after 45 seconds."
    except Exception as e:
        return f"Tool '{tool_name}' failed: {str(e)}"


async def refresh_tools() -> list[dict]:
    """Force-refresh the tools cache."""
    global _tools_fetched
    _tools_fetched = False
    return await fetch_tools()


def format_tools_for_prompt(tools: list[dict]) -> str:
    """Format tool list as compact text for injection into the system prompt."""
    if not tools:
        return "No tools currently available — answer from general knowledge only."

    lines = []
    for tool in tools:
        name = tool.get("name", "")
        desc = tool.get("description", "").split("\n")[0]
        schema = tool.get("inputSchema", {})
        props = schema.get("properties", {})
        required = schema.get("required", [])

        params = []
        for pname, pinfo in props.items():
            ptype = pinfo.get("type", "string")
            marker = "*" if pname in required else "?"
            params.append(f"{pname}:{ptype}{marker}")

        param_str = ", ".join(params) if params else "no params"
        lines.append(f"- {name}({param_str}): {desc}")

    return "\n".join(lines)
