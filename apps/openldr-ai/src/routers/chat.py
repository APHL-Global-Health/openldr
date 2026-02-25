import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import ChatRequest, ChatResponse
from services.inference import generate_stream, generate, is_model_loaded
from services.agentic_inference import agentic_stream


router = APIRouter(prefix="/chat", tags=["chat"])


async def _sse_generator(messages: list[dict], max_new_tokens: int, temperature: float):
    """Simple streaming - no tool use."""
    try:
        async for token in generate_stream(messages, max_new_tokens, temperature):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


async def _agentic_sse_generator(
    messages: list[dict],
    max_new_tokens: int,
    temperature: float,
):
    """
    Agentic streaming - model can call MCP tools before answering.
    Yields the same SSE format as the simple endpoint plus:
    - {"status": "Querying tool_name..."} while tool executes
    - {"tool_call": {...}} for frontend to show what tool was called
    """
    try:
        async for event in agentic_stream(messages, max_new_tokens, temperature):
            yield f"data: {event}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    Simple streaming chat - no tool use.
    Use for general conversation not requiring live data.
    """
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="No model loaded.")

    messages = [m.model_dump() for m in req.messages]
    return StreamingResponse(
        _sse_generator(messages, req.max_new_tokens, req.temperature),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/agent")
async def chat_agent(req: ChatRequest):
    """
    Agentic streaming chat - model can call MCP tools to fetch live lab data.

    The SSE stream yields:
    - {"token": "..."} - text tokens as they generate
    - {"status": "Querying search_lab_results..."} - while tool executes
    - {"tool_call": {"tool": "...", "args": {...}}} - what tool was called
    - {"done": true} - stream complete
    - {"error": "..."} - if something went wrong

    Frontend should show a "Querying data..." indicator on status events
    and optionally show which tool was called.
    """
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="No model loaded.")

    messages = [m.model_dump() for m in req.messages]
    return StreamingResponse(
        _agentic_sse_generator(messages, req.max_new_tokens, req.temperature),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Non-streaming chat - returns full response at once."""
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="No model loaded.")

    messages = [m.model_dump() for m in req.messages]
    content = await generate(messages, req.max_new_tokens, req.temperature)
    return ChatResponse(content=content)
