"""
ModelManager handles:
- Downloading GGUF models from HuggingFace with progress tracking
- Persisting models to AI_MODELS_DIR (Docker volume)
- Loading/unloading models into memory via llama-cpp-python
"""
import os
import threading
from pathlib import Path
from typing import Optional

from huggingface_hub import hf_hub_download
from huggingface_hub.utils import HfHubHTTPError

from core.config import settings
from core.state import download_state, loaded_model


def _get_model_local_path(model_id: str) -> Path:
    """
    Returns the local directory where a model is stored.
    HF uses a cache structure like: models--org--name/snapshots/<hash>
    We resolve the actual snapshot path after download.
    """
    safe_name = model_id.replace("/", "--")
    return Path(settings.AI_MODELS_DIR) / f"models--{safe_name}"


def is_model_downloaded(model_id: str, filename: str | None = None) -> bool:
    local_dir = Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--")
    if filename:
        gguf_path = local_dir / filename
        return gguf_path.exists() and os.path.getsize(gguf_path) > 0
    # No specific filename — check for any .gguf file in the model dir
    if not local_dir.exists():
        return False
    return any(f.suffix == ".gguf" and f.stat().st_size > 0 for f in local_dir.iterdir() if f.is_file())


def get_model_size_gb(model_id: str) -> float:
    path = _get_model_local_path(model_id)
    if not path.exists():
        # Also check the downloads dir
        path = Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--")
        if not path.exists():
            return 0.0
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    return round(total / (1024 ** 3), 2)


def _get_total_size_bytes(directory: str) -> int:
    """Sum all file sizes in a directory, including temp/incomplete files."""
    total = 0
    dir_path = Path(directory)
    if not dir_path.exists():
        return 0
    for f in dir_path.rglob("*"):
        if f.is_file():
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return total


def _monitor_download_progress(model_id: str, local_dir: str, total_gb: float, done_event: threading.Event) -> None:
    """Polls file sizes on disk to track download progress."""
    import time
    total_bytes = total_gb * (1024 ** 3) if total_gb > 0 else 0

    while not done_event.is_set():
        downloaded_bytes = _get_total_size_bytes(local_dir)
        downloaded_gb = downloaded_bytes / (1024 ** 3)
        progress = (downloaded_bytes / total_bytes * 100) if total_bytes > 0 else 0

        if model_id in download_state and download_state[model_id]["status"] == "downloading":
            download_state[model_id].update({
                "progress": round(min(progress, 99.9), 1),
                "downloaded_gb": round(downloaded_gb, 2),
            })

        done_event.wait(timeout=2.0)


def download_model_background(model_id: str, filename: str) -> None:
    """
    Runs in a background thread. Downloads a single GGUF file using hf_hub_download
    and tracks progress by monitoring file size on disk.
    """
    # Get total file size from HF API before starting download
    total_gb = 0.0
    try:
        from huggingface_hub import HfApi
        api = HfApi()
        model_info = api.model_info(model_id, files_metadata=True)
        for sibling in (model_info.siblings or []):
            if sibling.rfilename == filename:
                total_gb = round((sibling.size or 0) / (1024 ** 3), 2)
                break
    except Exception:
        pass

    download_state[model_id] = {
        "status": "downloading",
        "progress": 0.0,
        "downloaded_gb": 0.0,
        "total_gb": total_gb,
        "error": None,
    }

    local_dir = str(Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--"))
    Path(local_dir).mkdir(parents=True, exist_ok=True)

    # Start progress monitor in a separate thread
    done_event = threading.Event()
    monitor = threading.Thread(
        target=_monitor_download_progress,
        args=(model_id, local_dir, total_gb, done_event),
        daemon=True,
    )
    monitor.start()

    try:
        local_path = hf_hub_download(
            repo_id=model_id,
            filename=filename,
            local_dir=local_dir,
            local_dir_use_symlinks=False,
        )

        done_event.set()
        download_state[model_id]["local_path"] = local_path
        download_state[model_id]["status"] = "ready"
        download_state[model_id]["progress"] = 100.0
        download_state[model_id]["downloaded_gb"] = download_state[model_id]["total_gb"]

    except HfHubHTTPError as e:
        done_event.set()
        download_state[model_id]["status"] = "error"
        download_state[model_id]["error"] = f"HuggingFace error: {str(e)}"
    except Exception as e:
        done_event.set()
        download_state[model_id]["status"] = "error"
        download_state[model_id]["error"] = str(e)


def start_download(model_id: str, filename: str) -> bool:
    """
    Starts a background download if not already in progress.
    Returns True if started, False if already downloading or done.
    """
    state = download_state.get(model_id, {})
    if state.get("status") in ("downloading",):
        return False  # already running

    thread = threading.Thread(
        target=download_model_background,
        args=(model_id, filename),
        daemon=True,
        name=f"download-{model_id}",
    )
    thread.start()
    return True


def load_model(model_id: str, filename: str | None = None) -> tuple[bool, Optional[str]]:
    """
    Loads a GGUF model into memory via llama-cpp-python.
    Returns (success, error_message).
    The model must already be downloaded.
    """
    local_dir = Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--")
    if filename:
        gguf_path = local_dir / filename
    else:
        # Find the first .gguf file in the model directory
        gguf_files = [f for f in local_dir.iterdir() if f.suffix == ".gguf"] if local_dir.exists() else []
        if not gguf_files:
            return False, "Model not downloaded yet"
        gguf_path = gguf_files[0]

    if not gguf_path.exists() or os.path.getsize(gguf_path) == 0:
        return False, "Model not downloaded yet"

    try:
        from llama_cpp import Llama

        # Unload previous model to free memory
        if loaded_model:
            loaded_model.clear()

        llm = Llama(
            model_path=str(gguf_path),
            n_ctx=4096,
            n_threads=os.cpu_count() or 4,
            n_gpu_layers=0,
            verbose=False,
        )

        loaded_model["model_id"] = model_id
        loaded_model["filename"] = filename
        loaded_model["model"] = llm
        loaded_model["tokenizer"] = None

        return True, None

    except Exception as e:
        return False, str(e)
