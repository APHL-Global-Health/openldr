# OpenLDR AI

The AI inference service for [OpenLDR](../../), an open-source Laboratory Information Management System for antimicrobial resistance (AMR) surveillance and data processing. This service runs small language models locally to provide conversational AI capabilities -- enabling laboratory staff to query live data, track test requests and results, and monitor system health through natural language.

## AI Capabilities

- **Conversational Chat** -- Streaming and non-streaming chat completions powered by locally-hosted HuggingFace models (no external API calls required).
- **Agentic Tool Use** -- A two-path agentic inference engine that can call MCP (Model Context Protocol) tools to fetch live laboratory data before answering:
  - **Deterministic routing** -- A lightweight keyword-based selector picks the right tool directly from the user query, bypassing free-form generation for speed and reliability.
  - **Model-driven fallback** -- If the selector is not confident, the LLM generates a tool call in an agentic loop.
- **MCP Integration** -- Connects to the `openldr-mcp-server` via Streamable HTTP transport to discover and execute tools that query OpenLDR backend services (test results, patients, facilities, uploads, etc.).
- **Context Budget Management** -- Automatic prompt trimming and history compaction to fit within small-model context windows while preserving the most relevant conversation history.
- **Model Management** -- Download, list, load, and unload HuggingFace models at runtime via REST API. Models are persisted to a Docker volume for reuse across container restarts.
- **Result Compaction** -- Large tool results are automatically truncated and compacted to fit within token budgets, preventing small models from being overwhelmed by verbose data.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11 |
| Web Framework | FastAPI 0.135 + Uvicorn |
| ML Framework | PyTorch 2.x (CPU by default, CUDA optional) |
| Model Library | HuggingFace Transformers 5.x |
| Model Hub | `huggingface_hub` for downloading models |
| HTTP Client | `httpx` (async, for MCP communication) |
| Configuration | Pydantic Settings |
| Containerization | Docker (Python 3.11 slim-bookworm) |
| Orchestration | Docker Compose (v1/v2 compatible) |
| Monorepo | Turborepo + npm workspaces |
| Default Model | `LiquidAI/LFM2-1.2B-RAG` |

## API Endpoints

### Root

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service info (name, version, docs link) |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check -- returns status, version, and currently loaded model |

### Models

| Method | Path | Description |
|---|---|---|
| `GET` | `/models` | List all downloaded models with size and loaded status |
| `GET` | `/models/loaded` | Get the currently loaded model |
| `GET` | `/models/status/{model_id}` | Poll download progress for a model (supports slashed IDs like `Qwen/Qwen2.5-0.5B-Instruct`) |
| `POST` | `/models/download` | Start a background download of a HuggingFace model (returns 202 immediately) |
| `POST` | `/models/load` | Load a downloaded model into memory for inference (10-60s depending on size) |

### Chat

| Method | Path | Description |
|---|---|---|
| `POST` | `/chat` | Non-streaming chat -- returns full response at once |
| `POST` | `/chat/stream` | Streaming chat via SSE -- no tool use, general conversation |
| `POST` | `/chat/agent` | Agentic streaming chat via SSE -- model can call MCP tools before answering. Supports `stream: false` for non-streaming mode |

#### Chat Request Body

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Show me the last 5 lab results" }
  ],
  "max_new_tokens": 512,
  "temperature": 0.7,
  "stream": true
}
```

#### SSE Event Types (Streaming Endpoints)

| Event | Description |
|---|---|
| `{"token": "..."}` | A generated token (streamed incrementally) |
| `{"status": "...", "tool_call": {...}, "routing": {...}}` | A tool is being called (agentic endpoint only) |
| `{"done": true}` | Stream finished |
| `{"error": "..."}` | An error occurred |

### Documentation

| Method | Path | Description |
|---|---|---|
| `GET` | `/docs` | Swagger UI (interactive API docs) |
| `GET` | `/redoc` | ReDoc (alternative API docs) |

## Prerequisites

- **Docker** and **Docker Compose** (v1 or v2)
- **Node.js** >= 18 and **npm** (for monorepo scripts)
- **Python 3.11+** (only if running outside Docker)
- Minimum **512 MB RAM** for the container (configurable via `MEMORY_LIMIT`)
- Sufficient disk space for model downloads (1-5 GB per model)

## Configuration

### Environment Variables

The service is configured via environment variables, loaded from `.env` files assembled by the monorepo build system.

| Variable | Default | Description |
|---|---|---|
| `AI_APP_NAME` | `openldr-ai` | Service name |
| `AI_APP_VERSION` | `0.1.0` | Service version |
| `AI_DEBUG` | `false` | Enable debug mode |
| `AI_PORT` | `8100` | Port the service listens on |
| `AI_HOSTNAME` | `openldr-ai` | Container hostname |
| `AI_HF_HOME` | `/app/ai` | HuggingFace cache directory |
| `AI_MODELS_DIR` | `/app/ai` | Directory for downloaded models |
| `AI_CORS_ORIGINS` | `http://localhost,http://localhost:3000` | Comma-separated allowed CORS origins |
| `AI_DEFAULT_MODEL` | `LiquidAI/LFM2-1.2B-RAG` | Model to auto-load on startup (leave empty to skip) |
| `AI_MCP_URL` | `http://openldr-mcp-server:6060` | URL of the MCP server for tool discovery and execution |
| `AI_MAX_NEW_TOKENS` | `512` | Maximum tokens for generation |
| `AI_MAX_INPUT_TOKENS` | `4096` | Maximum input token budget |
| `AI_RESERVED_OUTPUT_TOKENS` | `768` | Tokens reserved for model output |
| `AI_CONTEXT_SAFETY_MARGIN_TOKENS` | `256` | Safety margin subtracted from token budget |
| `AI_MAX_HISTORY_MESSAGES` | `6` | Maximum conversation history messages retained |
| `AI_TOOL_RESULT_CHAR_LIMIT` | `3500` | Character limit for compacted tool results |
| `AI_MAX_TOOL_CALLS` | `2` | Maximum tool calls per agentic turn (prevents infinite loops) |

### Environment File Assembly

The `.env` file is assembled from two base files using the monorepo merge script:

```bash
npm run copy:env
# Merges: environments/.env.base + environments/.env.openldr-ai → .env
```

### Docker Compose

The `docker-compose.yml` defines the service:

- **Image**: Built from `Dockerfile` (Python 3.11 slim-bookworm)
- **Port**: `8100:8100`
- **Volume**: `./ai:/app/ai` -- persists downloaded models across restarts
- **Network**: `openldr-network` (bridge) -- shared with other OpenLDR services
- **Health check**: `GET /health` every 30s

### Dockerfile Highlights

- Base image: `python:3.11-slim-bookworm`
- CPU-only PyTorch by default (image ~2 GB). For GPU support, change the pip index URL to `https://download.pytorch.org/whl/cu121` in the Dockerfile.
- Models directory created at `/app/models`
- Runs via Uvicorn with a single worker

## Setup and Deployment

### Using Docker (Recommended)

From the **monorepo root**:

```bash
# Build and start all services (including openldr-ai)
npm run docker:build
npm run docker:start

# Or build/start only openldr-ai
cd apps/openldr-ai
npm run docker:build:off
npm run docker:start:off
```

### Stopping and Resetting

```bash
# Stop the service
npm run docker:stop

# Full reset (removes images, volumes, and .env)
npm run docker:reset
```

### Running Locally (Development)

```bash
cd apps/openldr-ai/src

# Install Python dependencies
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

### First Run

1. Start the service. If `AI_DEFAULT_MODEL` is set and the model is already downloaded, it loads automatically on startup.
2. If no model is downloaded yet, use the API to download one:
   ```bash
   curl -X POST http://localhost:8100/models/download \
     -H "Content-Type: application/json" \
     -d '{"model_id": "LiquidAI/LFM2-1.2B-RAG"}'
   ```
3. Poll download progress:
   ```bash
   curl http://localhost:8100/models/status/LiquidAI/LFM2-1.2B-RAG
   ```
4. Load the model into memory:
   ```bash
   curl -X POST http://localhost:8100/models/load \
     -H "Content-Type: application/json" \
     -d '{"model_id": "LiquidAI/LFM2-1.2B-RAG"}'
   ```
5. Start chatting:
   ```bash
   curl -X POST http://localhost:8100/chat/agent \
     -H "Content-Type: application/json" \
     -d '{"messages": [{"role": "user", "content": "Show me the latest lab results"}], "stream": false}'
   ```

## Integration with Other OpenLDR Services

```
openldr-studio / openldr-web (UI)
        │
        ▼
  openldr-gateway (:8090/443)
        │
        ▼
   openldr-ai (:8100)  ◄──  This service
        │
        ▼
  openldr-mcp-server (:6060)
        │
        ▼
  openldr-entity-services / openldr-internal-database / ...
```

- **openldr-gateway** -- Routes requests from the frontend to `openldr-ai`.
- **openldr-mcp-server** -- Provides MCP tools that `openldr-ai` calls to query live laboratory data. Connected via `AI_MCP_URL` over the shared `openldr-network` Docker network.
- **openldr-studio / openldr-web** -- Frontend applications that present the chat interface to users.
- **@openldr/mcp-server** and **@repo/openldr-core** -- Referenced as dev dependencies in `package.json` for shared types and configuration.

## Project Structure

```
apps/openldr-ai/
├── ai/                        # Downloaded model files (git-ignored, Docker volume)
├── src/
│   ├── main.py                # FastAPI app entrypoint + lifespan hooks
│   ├── requirements.txt       # Python dependencies
│   ├── core/
│   │   ├── config.py          # Pydantic Settings (env var configuration)
│   │   └── state.py           # In-memory state (download progress, loaded model)
│   ├── models/
│   │   └── schemas.py         # Pydantic request/response schemas
│   ├── routers/
│   │   ├── chat.py            # /chat endpoints (stream, agent, non-streaming)
│   │   ├── health.py          # /health endpoint
│   │   └── models.py          # /models endpoints (download, list, load)
│   └── services/
│       ├── agentic_inference.py   # Two-path agentic inference (deterministic + model-driven)
│       ├── context_budget.py      # Prompt budgeting and history trimming
│       ├── inference.py           # Basic streaming/non-streaming inference
│       ├── mcp_client.py          # MCP Streamable HTTP client
│       ├── model_manager.py       # HuggingFace model download and loading
│       ├── result_compactor.py    # Tool result truncation and compaction
│       ├── tool_prompt.py         # System prompt templates and tool-call parsing
│       └── tool_router.py        # Deterministic keyword-based tool selector
├── docker-compose.yml         # Docker Compose service definition
├── docker-compose.ts          # Docker Compose CLI wrapper (v1/v2 compatible)
├── Dockerfile                 # Container build definition
├── package.json               # npm package config (monorepo scripts)
├── tsconfig.json              # TypeScript config (for monorepo tooling)
└── LICENSE                    # Apache 2.0
```

## License

Apache License 2.0 -- see [LICENSE](./LICENSE) for details.
