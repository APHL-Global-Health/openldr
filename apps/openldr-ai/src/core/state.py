"""
Global in-memory state for tracking model downloads and loaded models.
Using a simple dict here since we run a single worker process.
If you scale to multiple workers later, migrate this to Redis.
"""
from typing import Any

# Tracks download progress per model_id
# Shape: { "Qwen/Qwen2.5-0.5B-Instruct": { "status": "downloading", "progress": 45, "error": None } }
download_state: dict[str, dict[str, Any]] = {}

# Holds the currently loaded model + tokenizer
# Shape: { "model_id": str, "model": <model>, "tokenizer": <tokenizer> }
loaded_model: dict[str, Any] = {}
