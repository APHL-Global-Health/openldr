from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime


# --- Model management ---

class ModelDownloadRequest(BaseModel):
    model_id: str  # e.g. "Qwen/Qwen2.5-0.5B-Instruct"
    filename: Optional[str] = None  # e.g. "LFM2-1.2B-Tool-Q8_0.gguf"


class ModelDownloadStatus(BaseModel):
    model_id: str
    status: Literal["idle", "downloading", "ready", "error"]
    progress: float = 0.0        # 0-100
    downloaded_gb: float = 0.0
    total_gb: float = 0.0
    error: Optional[str] = None
    loaded: bool = False          # True if currently loaded in memory


class AvailableModel(BaseModel):
    model_id: str
    size_gb: float
    downloaded_at: Optional[datetime] = None
    loaded: bool = False


class LoadModelRequest(BaseModel):
    model_id: str
    filename: Optional[str] = None


# --- Chat ---

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    max_new_tokens: int = 512
    temperature: float = 0.7
    stream: bool = True
    enable_thinking: bool = False


class ChatResponse(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


# --- Health ---

class HealthResponse(BaseModel):
    status: str
    version: str
    loaded_model: Optional[str] = None
