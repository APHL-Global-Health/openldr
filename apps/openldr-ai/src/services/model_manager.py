"""
ModelManager handles:
- Downloading models from HuggingFace with progress tracking
- Persisting models to AI_MODELS_DIR (Docker volume)
- Loading/unloading models into memory
"""
import os
import threading
from pathlib import Path
from typing import Optional

from huggingface_hub import snapshot_download
from huggingface_hub.utils import HfHubHTTPError
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

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


def is_model_downloaded(model_id: str) -> bool:
    path = _get_model_local_path(model_id)
    snapshots = path / "snapshots"
    if not snapshots.exists():
        return False
    # Has at least one snapshot directory with files
    for snap in snapshots.iterdir():
        if snap.is_dir() and any(snap.iterdir()):
            return True
    return False


def get_model_size_gb(model_id: str) -> float:
    path = _get_model_local_path(model_id)
    if not path.exists():
        return 0.0
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    return round(total / (1024 ** 3), 2)


def download_model_background(model_id: str) -> None:
    """
    Runs in a background thread. Downloads the model using huggingface_hub
    and tracks progress in download_state.
    """
    download_state[model_id] = {
        "status": "downloading",
        "progress": 0.0,
        "downloaded_gb": 0.0,
        "total_gb": 0.0,
        "error": None,
    }

    try:
        # huggingface_hub progress callback signature:
        # tqdm-compatible - we hook into the download by using local_dir
        local_dir = str(Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--"))
        Path(local_dir).mkdir(parents=True, exist_ok=True)

        # Track bytes via a custom tqdm class
        from tqdm import tqdm as original_tqdm

        class ProgressTqdm(original_tqdm):
            def update(self, n=1):
                super().update(n)
                if self.total:
                    download_state[model_id]["total_gb"] = round(self.total / (1024 ** 3), 3)
                    download_state[model_id]["downloaded_gb"] = round(self.n / (1024 ** 3), 3)
                    download_state[model_id]["progress"] = round((self.n / self.total) * 100, 1)

        # Monkey-patch tqdm for this thread only via context
        import huggingface_hub.file_download as fd
        original = fd.tqdm
        fd.tqdm = ProgressTqdm

        try:
            snapshot_download(
                repo_id=model_id,
                local_dir=local_dir,
                ignore_patterns=["*.msgpack", "flax_model*", "tf_model*", "rust_model*"],
            )
        finally:
            fd.tqdm = original  # always restore

        download_state[model_id]["status"] = "ready"
        download_state[model_id]["progress"] = 100.0

    except HfHubHTTPError as e:
        download_state[model_id]["status"] = "error"
        download_state[model_id]["error"] = f"HuggingFace error: {str(e)}"
    except Exception as e:
        download_state[model_id]["status"] = "error"
        download_state[model_id]["error"] = str(e)


def start_download(model_id: str) -> bool:
    """
    Starts a background download if not already in progress.
    Returns True if started, False if already downloading or done.
    """
    state = download_state.get(model_id, {})
    if state.get("status") in ("downloading",):
        return False  # already running

    thread = threading.Thread(
        target=download_model_background,
        args=(model_id,),
        daemon=True,
        name=f"download-{model_id}",
    )
    thread.start()
    return True


def load_model(model_id: str) -> tuple[bool, Optional[str]]:
    """
    Loads a model into memory. Returns (success, error_message).
    The model must already be downloaded.
    """
    if not is_model_downloaded(model_id):
        # Try the downloads dir path
        local_path = str(Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--"))
        if not Path(local_path).exists():
            return False, "Model not downloaded yet"
    else:
        local_path = None  # let transformers resolve from AI_HF_HOME

    try:
        # Unload previous model to free memory
        if loaded_model:
            loaded_model.clear()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        resolve_path = (
            local_path
            or str(Path(settings.AI_MODELS_DIR) / "downloads" / model_id.replace("/", "--"))
        )

        tokenizer = AutoTokenizer.from_pretrained(resolve_path)
        model = AutoModelForCausalLM.from_pretrained(
            resolve_path,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
            low_cpu_mem_usage=True,
        )

        if not torch.cuda.is_available():
            model = model.to("cpu")

        loaded_model["model_id"] = model_id
        loaded_model["model"] = model
        loaded_model["tokenizer"] = tokenizer

        return True, None

    except Exception as e:
        return False, str(e)
