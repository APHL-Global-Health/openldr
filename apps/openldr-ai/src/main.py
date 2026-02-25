from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import health, models, chat



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-load default model if configured
    if settings.AI_DEFAULT_MODEL:
        from services.model_manager import load_model, is_model_downloaded
        if is_model_downloaded(settings.AI_DEFAULT_MODEL):
            print(f"[startup] Loading default model: {settings.AI_DEFAULT_MODEL}")
            success, err = load_model(settings.AI_DEFAULT_MODEL)
            if success:
                print("[startup] Model loaded successfully")
            else:
                print(f"[startup] Failed to load model: {err}")
        else:
            print(f"[startup] Default model not downloaded: {settings.AI_DEFAULT_MODEL}")

    # Prefetch MCP tools so first request isn't slow
    try:
        from services.mcp_client import fetch_tools
        tools = await fetch_tools()
        print(f"[startup] MCP tools loaded: {[t['name'] for t in tools]}")
    except Exception as e:
        print(f"[startup] MCP tools unavailable (will retry on first request): {e}")

    yield


app = FastAPI(
    title=settings.AI_APP_NAME,
    version=settings.AI_APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(models.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {
        "service": settings.AI_APP_NAME,
        "version": settings.AI_APP_VERSION,
        "docs": "/docs",
    }
