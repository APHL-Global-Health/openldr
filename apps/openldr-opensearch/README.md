# OpenLDR OpenSearch

The search and analytics engine for the OpenLDR platform. This service runs [OpenSearch](https://opensearch.org/) 2.18.0 and OpenSearch Dashboards 2.18.0 as Docker containers, providing full-text search, real-time analytics, and data visualization for laboratory data messages flowing through the system.

## What It Does

OpenSearch serves as the central search and analytics layer in OpenLDR:

- **Message indexing** -- All messages passing through the Kafka pipeline (raw, validated, mapped, processed, and error notifications) are indexed into OpenSearch via a Kafka Connect sink connector.
- **Data aggregation and analytics** -- Supports aggregation queries for data feeds, projects, use cases, document counts per index, and time-based message frequency histograms.
- **Dashboards** -- OpenSearch Dashboards provides a web UI for exploring indexed data, building visualizations, and monitoring message throughput.
- **Health monitoring** -- The entity services layer probes OpenSearch availability as part of the platform health check.

## Tech Stack

| Component              | Version |
| ---------------------- | ------- |
| OpenSearch             | 2.18.0  |
| OpenSearch Dashboards  | 2.18.0  |
| Docker / Docker Compose | V2 (V1 fallback) |
| TypeScript (build scripts) | 5.x |
| tsx (script runner)    | --      |
| Turborepo (monorepo orchestration) | 2.x |

## Prerequisites

- **Docker** and **Docker Compose** (V2 recommended)
- **Node.js** >= 18
- **npm** 11.x (workspace-aware)
- At least **2 GB** of free memory for the OpenSearch container (hard limit), with 1 GB reserved

## Project Structure

```
apps/openldr-opensearch/
  docker-compose.yml      # Service definitions (OpenSearch + Dashboards)
  docker-compose.ts       # TypeScript wrapper for docker compose commands
  package.json            # npm scripts for build/start/stop/reset
  tsconfig.json           # TypeScript config (extends monorepo base)
  .env                    # Generated environment variables (do not edit manually)
  .dockerignore           # Docker build exclusions
  .gitignore              # Git exclusions (.env)
  LICENSE                 # Apache 2.0
```

## Configuration

### Environment Variables

Environment files are generated automatically by the `copy:env` script, which merges the base environment (`environments/.env.base`) with the OpenSearch-specific overrides (`environments/.env.openldr-opensearch`).

**Do not edit `.env` directly.** Instead, modify the source files in the `environments/` directory at the repository root.

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `COMPOSE_PROJECT_NAME` | `openldr` | Docker Compose project name (shared across all services) |
| `OPENSEARCH_PORT` | `9200` | OpenSearch REST API port |
| `OPENSEARCH_DASHBOARD_PORT` | `5601` | OpenSearch Dashboards port |
| `OPENSEARCH_MEMORY` | `512m` | JVM heap size (`-Xms` / `-Xmx`) |
| `OPENSEARCH_CPU_LIMIT` | *(unset)* | CPU limit for the container (commented out by default) |
| `OPENSEARCH_HOSTNAME` | `openldr-opensearch` | Internal Docker hostname for OpenSearch |
| `OPENSEARCH_DASHBORD_HOSTNAME` | `openldr-opensearch-dashboard` | Internal Docker hostname for Dashboards |
| `HOST_IP` | `127.0.0.1` | Host machine IP address |
| `DOCKER_HOST_IP` | `127.0.0.1` | Docker host IP |
| `GATEWAY_HTTP_PORT` | `8090` | Gateway HTTP port (used for proxied access) |
| `GATEWAY_HTTPS_PORT` | `443` | Gateway HTTPS port |

### Docker Compose Configuration

The `docker-compose.yml` defines two services:

**opensearch** -- Single-node OpenSearch cluster with:
- `discovery.type=single-node` (no cluster coordination overhead)
- ML Commons plugin configured for non-ML nodes
- Security plugin disabled (`DISABLE_SECURITY_PLUGIN=true`)
- Memory limit of 2 GB with 1 GB reservation, plus 3 GB swap limit
- Persistent volume `opensearch-data` mounted at `/usr/share/opensearch/data`

**opensearch-dashboard** -- OpenSearch Dashboards with:
- Connection to OpenSearch at `http://openldr-opensearch:9200`
- Security Dashboards plugin disabled
- Base path set to `/opensearch-dashboard` (for reverse proxy routing through the gateway)

Both services connect to the shared `openldr-network` bridge network. Ports are not published to the host by default; access is routed through the OpenLDR gateway (nginx).

## Index Management and Mappings

Indexes are created automatically by the Kafka Connect OpenSearch sink connector. The following indexes correspond to Kafka topics representing each stage of the data processing pipeline:

| Index | Description |
| ----- | ----------- |
| `raw-inbound` | Raw messages as received from data sources |
| `validated-inbound` | Messages that have passed validation |
| `mapped-inbound` | Messages after field mapping / transformation |
| `processed-inbound` | Fully processed messages ready for consumption |
| `errors-notifications` | Error events and notification messages |

Mappings are schema-less (`"schema.ignore": "true"` in the connector config). OpenSearch dynamically maps fields upon first ingestion. Key fields used in aggregation queries include:

- `Records.s3.object.userMetadata.X-Amz-Meta-Usecase.keyword` -- Use case identifier
- `Records.s3.object.userMetadata.X-Amz-Meta-Senders.keyword` -- Data feed / sender identifier
- `Records.s3.object.userMetadata.X-Amz-Meta-Project.keyword` -- Project identifier
- `Records.eventTime` -- Event timestamp (used for time-series histograms)

## Setup and Deployment

### Quick Start (via Turborepo)

From the repository root:

```bash
# Pull OpenSearch images
npm run docker:build

# Start OpenSearch and Dashboards
npm run docker:start

# Stop services
npm run docker:stop

# Full reset (remove containers, images, volumes)
npm run docker:reset
```

### Service-Level Commands

From the `apps/openldr-opensearch/` directory:

```bash
# Pull images
npm run docker:build

# Start containers (detached, force recreate)
npm run docker:start

# Stop containers
npm run docker:stop

# Full reset (remove containers, images, volumes, and orphans)
npm run docker:reset
```

Each command first runs `copy:env` to regenerate the `.env` file from the environment sources, then invokes Docker Compose through the `docker-compose.ts` wrapper (which tries Docker Compose V2 first, with a V1 fallback and up to 3 retries).

### Verifying the Service

Once running, verify OpenSearch is healthy:

```bash
# Direct (if ports are published)
curl http://localhost:9200

# Through the gateway
curl http://localhost:8090/opensearch/
```

## Docker Support

This service is entirely Docker-based. There is no standalone application to build -- it pulls official OpenSearch images and runs them as containers.

- **Image**: `opensearchproject/opensearch:2.18.0`
- **Dashboard image**: `opensearchproject/opensearch-dashboards:2.18.0`
- **Container names**: `openldr-opensearch`, `openldr-opensearch-dashboard`
- **Volume**: `opensearch-data` (persistent data storage)
- **Network**: `openldr-network` (bridge, shared with all OpenLDR services)

### Resource Limits

| Resource | Limit |
| -------- | ----- |
| Memory (container) | 2 GB |
| Memory (reserved) | 1 GB |
| Swap | 3 GB |
| JVM Heap | Configurable via `OPENSEARCH_MEMORY` (default 512m) |

## Integration with Other OpenLDR Services

### Kafka Connect (openldr-kafka)

The primary data ingestion path is through a **Kafka Connect OpenSearch sink connector** configured in `apps/openldr-kafka/openldr.ts`. During Kafka initialization:

1. The connector `opensearch-sink` is created with class `io.aiven.kafka.connect.opensearch.OpensearchSinkConnector`.
2. It subscribes to topics: `raw-inbound`, `validated-inbound`, `mapped-inbound`, `processed-inbound`, `errors-notifications`.
3. Messages are converted from JSON (schema-less) and written to corresponding OpenSearch indexes.
4. Up to 4 tasks run in parallel (`tasks.max: 4`).

The connector targets `http://openldr-opensearch:9200` using the internal Docker network.

### Entity Services (openldr-entity-services)

The `opensearch.service.ts` module in entity services provides an API layer on top of OpenSearch using the `@opensearch-project/opensearch` client. It exposes:

- `GET /opensearch?index=<name>` -- Aggregated data feeds, projects, and use cases for a given index
- `GET /opensearch/index-document-count` -- Document counts across all pipeline indexes
- `GET /opensearch/interval-message-count` -- Time-bucketed message counts (10-minute intervals) for the current day
- `GET /opensearch/latest-messages` -- The 5 most recent processed messages

### Gateway (openldr-gateway)

Nginx reverse proxy routes provide external access:

- `/opensearch/` proxies to `openldr-opensearch:9200`
- `/opensearch-dashboard/` proxies to `openldr-opensearch-dashboard:5601`

### Dashboard Service (openldr-entity-services)

The entity services dashboard performs health probes against OpenSearch (`http://<OPENSEARCH_HOSTNAME>:9200`) and reports its status as part of the platform-wide service health check.

## OpenSearch Dashboards

OpenSearch Dashboards is available through the gateway at:

```
http://<HOST_IP>:<GATEWAY_HTTP_PORT>/opensearch-dashboard/
```

Use Dashboards to:

- Explore indexed data across all pipeline stages
- Create index patterns for `raw-inbound`, `validated-inbound`, `mapped-inbound`, `processed-inbound`, and `errors-notifications`
- Build visualizations for message throughput, error rates, and processing latency
- Set up saved searches and dashboards for operational monitoring

The Dashboards security plugin is disabled, so no login is required in the default configuration.

## Troubleshooting

### OpenSearch fails to start

**Symptom**: Container exits immediately or restarts in a loop.

- Check available memory. OpenSearch requires at least 1 GB reserved and has a 2 GB hard limit. Run `docker stats` to inspect usage.
- On Linux, OpenSearch may fail if `vm.max_map_count` is too low:
  ```bash
  sudo sysctl -w vm.max_map_count=262144
  ```
  To make it permanent, add `vm.max_map_count=262144` to `/etc/sysctl.conf`.

### Cannot connect to OpenSearch

- Ports are **not published** by default (commented out in `docker-compose.yml`). Access OpenSearch through the gateway at `http://localhost:8090/opensearch/`.
- To expose ports directly, uncomment the `ports` section in `docker-compose.yml`.
- Verify the container is running: `docker ps | grep openldr-opensearch`.

### Kafka Connect sink connector not creating indexes

- Ensure the Kafka service is fully initialized before expecting data in OpenSearch. The connector is created during `openldr-kafka` setup.
- Check connector status:
  ```bash
  curl http://localhost:8090/kafka-connect/connectors/opensearch-sink/status
  ```
- Verify OpenSearch is reachable from the Kafka Connect container:
  ```bash
  docker exec openldr-kafka-connect curl http://openldr-opensearch:9200
  ```

### Dashboard shows "No indices match" or empty visualizations

- Confirm that data has been ingested by checking document counts:
  ```bash
  curl http://localhost:8090/opensearch/_cat/indices?v
  ```
- Create index patterns in Dashboards matching the index names (`raw-inbound`, `validated-inbound`, etc.).

### High memory usage

- Reduce the JVM heap by setting `OPENSEARCH_MEMORY` in `environments/.env.openldr-opensearch` (e.g., `256m`).
- Monitor with: `docker stats openldr-opensearch`.

### Resetting all data

To completely wipe OpenSearch data and start fresh:

```bash
npm run docker:reset
```

This removes containers, images, volumes (including `opensearch-data`), and orphan containers.

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.
