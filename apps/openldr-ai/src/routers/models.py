from fastapi import APIRouter, HTTPException, BackgroundTasks
from pathlib import Path

from models.schemas import (
    ModelDownloadRequest,
    ModelDownloadStatus,
    AvailableModel,
    LoadModelRequest,
)
from services.model_manager import (
    start_download,
    is_model_downloaded,
    get_model_size_gb,
    load_model,
)
from core.state import download_state, loaded_model
from core.config import settings

router = APIRouter(prefix="/models", tags=["models"])


@router.post("/download", status_code=202)
async def download_model(req: ModelDownloadRequest):
    """
    Kicks off a background download of a HuggingFace model.
    Returns 202 Accepted immediately - poll /models/status/{model_id} for progress.
    """
    if is_model_downloaded(req.model_id):
        return {"message": "Model already downloaded", "model_id": req.model_id}

    started = start_download(req.model_id)
    if not started:
        return {"message": "Download already in progress", "model_id": req.model_id}

    return {"message": "Download started", "model_id": req.model_id}


@router.get("/status/{model_id:path}", response_model=ModelDownloadStatus)
async def get_download_status(model_id: str):
    """
    Returns the download status for a specific model.
    The :path converter handles slashes in model IDs like "Qwen/Qwen2.5-0.5B-Instruct".
    """
    # Check if already downloaded (may not have gone through our download flow)
    if is_model_downloaded(model_id) and model_id not in download_state:
        return ModelDownloadStatus(
            model_id=model_id,
            status="ready",
            progress=100.0,
            loaded=loaded_model.get("model_id") == model_id,
        )

    state = download_state.get(model_id)
    if not state:
        return ModelDownloadStatus(model_id=model_id, status="idle")

    return ModelDownloadStatus(
        model_id=model_id,
        status=state["status"],
        progress=state["progress"],
        downloaded_gb=state["downloaded_gb"],
        total_gb=state["total_gb"],
        error=state["error"],
        loaded=loaded_model.get("model_id") == model_id,
    )


@router.get("", response_model=list[AvailableModel])
async def list_models():
    """
    Lists all models that have been downloaded to AI_MODELS_DIR.
    """
    downloads_dir = Path(settings.AI_MODELS_DIR) / "downloads"
    if not downloads_dir.exists():
        return []

    result = []
    for model_dir in downloads_dir.iterdir():
        if not model_dir.is_dir():
            continue
        # Convert safe name back: "Qwen--Qwen2.5-0.5B-Instruct" -> "Qwen/Qwen2.5-0.5B-Instruct"
        model_id = model_dir.name.replace("--", "/", 1)
        size_gb = get_model_size_gb(model_id)
        result.append(
            AvailableModel(
                model_id=model_id,
                size_gb=size_gb,
                loaded=loaded_model.get("model_id") == model_id,
            )
        )

    return result


@router.post("/load")
async def load_model_endpoint(req: LoadModelRequest):
    """
    Loads a downloaded model into memory for inference.
    This can take 10-60s depending on model size.
    """
    success, error = load_model(req.model_id)
    if not success:
        raise HTTPException(status_code=400, detail=error)
    return {"message": f"Model {req.model_id} loaded successfully"}


@router.get("/loaded")
async def get_loaded_model():
    """Returns info about the currently loaded model."""
    if not loaded_model.get("model_id"):
        return {"loaded": False, "model_id": None}
    return {"loaded": True, "model_id": loaded_model["model_id"]}
