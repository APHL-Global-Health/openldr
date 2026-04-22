# OpenLDR Docker Hub Deployment

Deploy OpenLDR services using pre-built Docker Hub images. No need to clone the full monorepo or build locally.

## Prerequisites

- Docker Engine 24+
- Docker Compose v2
- 16GB+ RAM recommended
- Docker Hub account (for pushing images)

## Quick Start (Deploying with Pre-built Images)

If images have already been published to Docker Hub, you can deploy without the full monorepo:

### 1. Get the deployment files

You only need the `docker/` folder. Either clone the full repo or copy just this folder:

```bash
git clone https://github.com/APHL-Global-Health/openldr.git
cd openldr/docker
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and update:
- **All `<change-me>` values** — passwords for PostgreSQL, Keycloak, MinIO, Kafka Conduktor, and the credential encryption key
- **`DOCKER_REGISTRY`** — your Docker Hub username or organization (e.g., `fmwasekaga`)
- **`HOST_IP` and `DOCKER_HOST_IP`** — your server's IP address or domain
- **Public URLs** — update `KEYCLOAK_PUBLIC_URL`, `ENTITY_SERVICES_PUBLIC_URL`, `DATA_PROCESSING_PUBLIC_URL`, `MINIO_BROWSER_REDIRECT_URL`, and `MINIO_PUBLIC_URL` to match your `HOST_IP`

### 3. Set up SSL certificates

Replace the self-signed certs in `certs/` with your own, or use the defaults for development (browsers will show a security warning).

### 4. Copy Kafka Connect JARs

```bash
# From the full repo:
cp ../apps/openldr-kafka/kafka-connect/*.jar config/kafka-connect/

# Or download the Aiven OpenSearch Connector separately (see Kafka Connect JARs section below)
```

### 5. Start all services

```bash
docker compose up -d
```

### 6. Verify

```bash
# Check all services are running
docker compose ps

# Verify init container completed successfully (configures Keycloak, Kafka, MinIO)
docker compose logs openldr-init
```

The gateway will be available at `https://<HOST_IP>:443`.

### Startup sequence

Services start in a strict dependency order:

1. **PostgreSQL** — database foundation
2. **Gateway (Nginx)** — reverse proxy (ports 80, 443)
3. **Keycloak** — SSO / identity management
4. **OpenSearch** — full-text search
5. **Kafka** (Zookeeper → Broker → Connect → Conduktor) — message streaming
6. **MinIO** — object storage
7. **`openldr-init`** — one-shot container that configures Keycloak realm/clients, Kafka OpenSearch connector, and MinIO buckets/plugins, then exits
8. **Application services** — entity-services → data-processing → external-database → MCP server → AI → Web/Studio

Application services only start after `openldr-init` completes successfully.

## Building & Pushing Images to Docker Hub

This is for **maintainers** who need to publish new image versions.

### First-time setup

```bash
# Log in to Docker Hub
docker login

# (Optional) Create a Docker Hub organization for your team
# e.g., "openldr" — then set DOCKER_REGISTRY=openldr in your .env
```

### Build and push all images

Run from the **repository root** (not from the `docker/` folder):

**Linux / macOS:**
```bash
# Build and push with defaults (registry: openldr, tag: latest)
./docker/scripts/build-and-push.sh

# Custom registry and tag
./docker/scripts/build-and-push.sh --registry myorg --tag v1.0.0

# Dry run (print commands without executing)
./docker/scripts/build-and-push.sh --dry-run

# Build only, don't push
./docker/scripts/build-and-push.sh --no-push
```

**Windows (PowerShell):**
```powershell
# Build and push with defaults
.\docker\scripts\build-and-push.ps1

# Custom registry and tag
.\docker\scripts\build-and-push.ps1 -Registry myorg -Tag v1.0.0

# Dry run
.\docker\scripts\build-and-push.ps1 -DryRun

# Build only, don't push
.\docker\scripts\build-and-push.ps1 -NoPush
```

### Images published

| Image | Description |
|-------|-------------|
| `openldr/openldr-web` | Main web application (React) |
| `openldr/openldr-studio` | Studio / data analysis app (React) |
| `openldr/openldr-gateway` | API Gateway (Nginx reverse proxy) |
| `openldr/openldr-entity-services` | Entity management service |
| `openldr/openldr-data-processing` | Data processing pipeline |
| `openldr/openldr-external-database` | External database service |
| `openldr/openldr-ai` | AI service (FastAPI + PyTorch) |
| `openldr/openldr-mcp-server` | Model Context Protocol server |
| `openldr/openldr-internal-database` | PostgreSQL with TDS FDW + extensions |
| `openldr/openldr-init` | One-shot init container (configures Keycloak, Kafka, MinIO) |

## Initialization Container

The `openldr-init` service is a one-shot container that runs after all infrastructure services are healthy. It configures:

1. **Keycloak** — imports the OpenLDR realm and creates OAuth2 clients
2. **Kafka** — creates the OpenSearch sink connector in Kafka Connect
3. **MinIO** — seeds default plugins, creates buckets, configures Kafka notifications

Application services (`entity-services`, `data-processing`, etc.) depend on `openldr-init` completing successfully via `service_completed_successfully`. This ensures all infrastructure is fully configured before any application service starts.

After initialization, the container exits with code 0 and does not restart. You can check its output with:
```bash
docker compose logs openldr-init
```

## SSL Certificate Configuration

### Development (default)
The `certs/` directory contains self-signed certificates. These work for local development but browsers will show a security warning.

### Production
Replace the certificates in `certs/` with your own:

```bash
# Using Let's Encrypt / certbot
certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/domain.crt
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/domain.key
```

Update `HOST_IP` in `.env` to match your domain or server IP.

## Service Architecture

```
                    ┌─────────────────┐
                    │  Gateway (Nginx) │ :80, :443
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
   ┌────┴────┐         ┌────┴────┐          ┌─────┴─────┐
   │   Web   │         │ Studio  │          │    AI      │ :8100
   └─────────┘         └─────────┘          └─────┬─────┘
                                                   │
                                             ┌─────┴─────┐
                                             │ MCP Server │ :6060
                                             └───────────┘

   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ Entity Services   │  │ Data Processing  │  │ External Database│
   └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
            │                      │                      │
   ┌────────┴──────────────────────┴──────────────────────┴────────┐
   │                        Infrastructure                          │
   │  PostgreSQL │ Keycloak │ Kafka │ MinIO │ OpenSearch            │
   └────────────────────────────────────────────────────────────────┘
```

## Kafka Connect JARs

The Kafka Connect service requires OpenSearch connector JARs. These are not included in this folder due to size.

**Option A** — Copy from the full repository:
```bash
cp ../apps/openldr-kafka/kafka-connect/*.jar config/kafka-connect/
```

**Option B** — Download separately:
Download the [Aiven OpenSearch Connector for Apache Kafka](https://github.com/aiven/opensearch-connector-for-apache-kafka/releases) and place the JARs in `config/kafka-connect/`.

## Docker Socket Mount

The `entity-services`, `data-processing`, and `external-database` services mount `/var/run/docker.sock` to execute extensions in isolated containers. In production environments using rootless Docker or Kubernetes, adjust this accordingly.

## Troubleshooting

**Services failing to start?**
```bash
docker compose logs <service-name>
```

**Keycloak health check timing out?**
Keycloak can take 60-90 seconds to start. Check logs with:
```bash
docker compose logs openldr-keycloak
```

**Database not initializing?**
Migration SQL files run only on first startup (empty volume). To re-run:
```bash
docker compose down -v  # WARNING: deletes all data
docker compose up -d
```

**AI service downloading models on first start?**
The AI service downloads the configured model on first boot. This may take several minutes depending on connection speed. The `ai_models` volume persists the download across restarts.
