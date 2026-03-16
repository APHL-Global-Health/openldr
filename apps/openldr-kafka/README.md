# OpenLDR Kafka

The messaging backbone of the OpenLDR v2 platform. This service provides an Apache Kafka cluster with Zookeeper coordination, Kafka Connect for sink integrations, and Conduktor Console for cluster management. It serves as the central event bus that drives the entire data processing pipeline -- from raw lab data ingestion through validation, mapping, storage, and outpost delivery.

---

## Table of Contents

- [Role in the OpenLDR System](#role-in-the-openldr-system)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Topics](#topics)
- [Kafka Connect](#kafka-connect)
- [Conduktor Console](#conduktor-console)
- [Setup and Deployment](#setup-and-deployment)
- [Docker Support](#docker-support)
- [Integration with Other Services](#integration-with-other-services)
- [Monitoring and Management](#monitoring-and-management)
- [Gateway Routing](#gateway-routing)
- [Troubleshooting](#troubleshooting)

---

## Role in the OpenLDR System

OpenLDR v2 is an event-driven laboratory data repository. Kafka sits at its center, decoupling data producers (MinIO object notifications) from consumers (the data processing pipeline stages). Every lab result that enters the system flows through a sequence of Kafka topics, each representing a stage of the processing pipeline. Kafka Connect then sinks processed events into OpenSearch for indexing and observability.

---

## Architecture Overview

```text
                              OpenLDR Kafka Architecture
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                                                                             │
 │   MinIO (Object Storage)                                                    │
 │   ├── raw/          ──► Kafka Notification ──► raw-inbound                  │
 │   ├── validated/    ──► Kafka Notification ──► validated-inbound             │
 │   ├── mapped/       ──► Kafka Notification ──► mapped-inbound               │
 │   └── processed/    ──► Kafka Notification ──► processed-inbound            │
 │                                                                             │
 └─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                          Apache Kafka Cluster                               │
 │                                                                             │
 │   Zookeeper (openldr-kafka-zoo1)                                            │
 │       └── Cluster coordination on port 2181                                 │
 │                                                                             │
 │   Broker (openldr-kafka1)                                                   │
 │       ├── INTERNAL  listener  :19092  (inter-broker + internal services)     │
 │       ├── EXTERNAL  listener  :9094   (host machine access)                 │
 │       └── DOCKER    listener  :29092  (container-to-container)              │
 │                                                                             │
 └─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                      Data Processing Pipeline                               │
 │                                                                             │
 │   raw-inbound                                                               │
 │       │  Consumer: openldr-validation-consumer                              │
 │       │  Validates and normalizes raw lab data                              │
 │       ▼                                                                     │
 │   validated-inbound                                                         │
 │       │  Consumer: openldr-mapper-consumer                                  │
 │       │  Resolves terminology, maps concept codes to IDs                    │
 │       ▼                                                                     │
 │   mapped-inbound                                                            │
 │       │  Consumer: openldr-storage-consumer                                 │
 │       │  Final integrity checks, marks as processed                         │
 │       ▼                                                                     │
 │   processed-inbound                                                         │
 │       │  Consumer: openldr-outpost-consumer                                 │
 │       │  Delivers to external systems / final persistence                   │
 │       ▼                                                                     │
 │   (Pipeline complete)                                                       │
 │                                                                             │
 │   Dead-Letter Topics (on failure at any stage):                             │
 │       raw-inbound-dead-letter                                               │
 │       validated-inbound-dead-letter                                         │
 │       mapped-inbound-dead-letter                                            │
 │       processed-inbound-dead-letter                                         │
 │                                                                             │
 └─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                          Kafka Connect                                      │
 │                                                                             │
 │   OpenSearch Sink Connector (opensearch-sink)                               │
 │       Sinks topics into OpenSearch indices:                                 │
 │       ├── raw-inbound                                                       │
 │       ├── validated-inbound                                                 │
 │       ├── mapped-inbound                                                    │
 │       ├── processed-inbound                                                 │
 │       └── errors-notifications                                              │
 │                                                                             │
 │       Dead letter: deadletterqueue-error-log                                │
 │                                                                             │
 └─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                       Conduktor Console                                     │
 │       Web UI for cluster management, topic browsing, and monitoring         │
 │       Accessible via gateway at /kafka-console/                             │
 └─────────────────────────────────────────────────────────────────────────────┘
```

### Message Flow Summary

```text
File upload ──► MinIO bucket (raw/) ──► S3 event notification
    ──► raw-inbound ──► Validation ──► validated-inbound
    ──► Mapping ──► mapped-inbound ──► Storage ──► processed-inbound
    ──► Outpost ──► (downstream delivery)

At each stage, failures route to: <topic>-dead-letter

All pipeline topics are also sunk into OpenSearch via Kafka Connect.
```

---

## Tech Stack

| Component | Image / Version | Purpose |
|---|---|---|
| Apache Kafka | `confluentinc/cp-kafka:7.7.1` | Message broker |
| Zookeeper | `confluentinc/cp-zookeeper:7.7.1` | Cluster coordination |
| Kafka Connect | `confluentinc/cp-kafka-connect:7.7.1` | Connector framework for sinks/sources |
| Conduktor Console | `conduktor/conduktor-console:1.41.0` | Web-based Kafka management UI |
| OpenSearch Connector | `opensearch-connector-for-apache-kafka-3.1.1` | Sink connector plugin (Aiven) |
| KafkaJS | (in `openldr-data-processing`) | Node.js Kafka client library |

---

## Prerequisites

- **Docker** and **Docker Compose** (v2 preferred, v1 fallback supported)
- **Node.js** >= 18
- **npm** 11.3.0+ (monorepo workspace manager)
- **PostgreSQL** running (for Conduktor Console database: `conduktor_console`)
- **OpenSearch** running (for the sink connector target)
- **MinIO** running (produces S3 event notifications to Kafka topics)
- At minimum **2 GB RAM** per container (Kafka, Zookeeper, Kafka Connect, Conduktor each require 2 GB limit / 1 GB reserved)

---

## Configuration

### Environment Variables

Configuration is driven by the `.env` file, which is auto-generated by merging multiple environment files from the `environments/` directory at the monorepo root. Key Kafka-related variables:

| Variable | Default | Description |
|---|---|---|
| `KAFKA_EXTERNAL_PORT` | `9094` | Host-accessible broker port (EXTERNAL listener) |
| `KAFKA_DOCKER_PORT` | `29092` | Docker inter-container broker port (DOCKER listener) |
| `KAFKA_CONNECT_PORT` | `8083` | Kafka Connect REST API port |
| `KAFKA_CONDUKTOR_PORT` | `8082` | Conduktor Console port |
| `KAFKA_CONDUKTOR_USERNAME` | `admin` | Conduktor admin login email |
| `KAFKA_CONDUKTOR_PASSWORD` | `Openldr123$` | Conduktor admin password |
| `KAFKA_HOSTNAME` | `openldr-kafka1` | Kafka broker container hostname |
| `KAFKA_CONNECT_HOSTNAME` | `openldr-kafka-connect` | Kafka Connect container hostname |
| `KAFKA_CONDUKTOR_HOSTNAME` | `openldr-kafka-conduktor-console` | Conduktor container hostname |
| `DOCKER_HOST_IP` | `127.0.0.1` | Host IP for advertised listeners |
| `POSTGRES_USER` | `postgres` | PostgreSQL user (for Conduktor database) |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `POSTGRES_HOSTNAME` | `openldr-postgres` | PostgreSQL hostname |
| `OPENSEARCH_PORT` | `9200` | OpenSearch port (for sink connector) |

### Kafka Broker Configuration

The broker is configured with three listeners:

| Listener | Bind Address | Advertised Address | Protocol | Purpose |
|---|---|---|---|---|
| INTERNAL | `0.0.0.0:19092` | `openldr-kafka1:19092` | PLAINTEXT | Inter-broker communication, internal services |
| EXTERNAL | `0.0.0.0:9092` | `${DOCKER_HOST_IP}:9094` | PLAINTEXT | Host machine access |
| DOCKER | `0.0.0.0:29092` | `localhost:29092` | PLAINTEXT | Container-to-container communication |

Additional broker settings (tuned for development):

- `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR`: 1
- `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR`: 1
- `KAFKA_ALLOW_EVERYONE_IF_NO_ACL_FOUND`: true
- JMX monitoring enabled on port 9001

---

## Topics

### Pipeline Topics

These topics form the core data processing pipeline. MinIO emits S3 object-created events to these topics when files land in the corresponding bucket prefixes.

| Topic | Producer | Consumer Group | Description |
|---|---|---|---|
| `raw-inbound` | MinIO (prefix: `raw/`) | `openldr-validation-consumer` | Raw lab data files uploaded for processing |
| `validated-inbound` | MinIO (prefix: `validated/`) | `openldr-mapper-consumer` | Data that passed schema validation and normalization |
| `mapped-inbound` | MinIO (prefix: `mapped/`) | `openldr-storage-consumer` | Data with terminology codes resolved to concept IDs |
| `processed-inbound` | MinIO (prefix: `processed/`) | `openldr-outpost-consumer` | Fully processed data ready for downstream delivery |

### Error and Dead-Letter Topics

| Topic | Description |
|---|---|
| `raw-inbound-dead-letter` | Failed validation stage messages |
| `validated-inbound-dead-letter` | Failed mapping stage messages (topic naming implied by `${topic}-dead-letter`) |
| `mapped-inbound-dead-letter` | Failed storage stage messages |
| `processed-inbound-dead-letter` | Failed outpost stage messages |
| `errors-notifications` | General error notifications (sunk to OpenSearch) |
| `deadletterqueue-error-log` | Kafka Connect dead letter queue for sink connector failures |

### Internal Kafka Connect Topics

| Topic | Description |
|---|---|
| `connect-configs` | Kafka Connect distributed configuration storage |
| `connect-offsets` | Kafka Connect offset tracking |
| `connect-status` | Kafka Connect connector and task status |

---

## Kafka Connect

### Overview

Kafka Connect runs as a distributed worker using the Confluent Platform image. It is configured with JSON converters (schemas disabled) for both keys and values, matching the format produced by MinIO and the data processing pipeline.

### OpenSearch Sink Connector

The primary connector is an **OpenSearch Sink** that indexes pipeline events for search and observability. It is provisioned programmatically via the `openldr.ts` lifecycle script.

**Connector configuration:**

| Property | Value |
|---|---|
| Name | `opensearch-sink` |
| Connector Class | `io.aiven.kafka.connect.opensearch.OpensearchSinkConnector` |
| Tasks | 4 |
| Topics | `raw-inbound`, `validated-inbound`, `mapped-inbound`, `processed-inbound`, `errors-notifications` |
| Key Converter | `StringConverter` |
| Value Converter | `JsonConverter` (schemas disabled) |
| Error Tolerance | `all` |
| DLQ Topic | `deadletterqueue-error-log` |
| Malformed Document Behavior | `warn` |

### Plugin JARs

The `kafka-connect/` directory contains the OpenSearch connector and its dependencies, mounted into the Kafka Connect container at `/etc/kafka-connect/jars/`. Key JARs include:

- `opensearch-connector-for-apache-kafka-3.1.1.jar` -- the Aiven OpenSearch sink connector
- `opensearch-rest-high-level-client-2.9.0.jar` -- OpenSearch Java client
- `opensearch-rest-client-2.9.0.jar` -- Low-level REST client
- Various Lucene, Jackson, HTTP, and logging libraries

All plugin JARs are licensed under Apache License 2.0.

---

## Conduktor Console

Conduktor Console provides a web-based UI for managing and monitoring the Kafka cluster.

### Configuration

| Property | Value |
|---|---|
| Admin Email | Configured via `KAFKA_CONDUKTOR_USERNAME` |
| Admin Password | Configured via `KAFKA_CONDUKTOR_PASSWORD` |
| Database | PostgreSQL (`conduktor_console` database on the shared OpenLDR Postgres instance) |
| Cluster Name | `OpenLDR Kafka` |
| Bootstrap Servers | `PLAINTEXT://openldr-kafka1:19092` |
| Kafka Connect Integration | `http://openldr-kafka-connect:8083` (named "full stack kafka connect") |

### Data Persistence

Conduktor data is persisted in two locations:

- **PostgreSQL**: metadata and console state in the `conduktor_console` database
- **Local volume**: `./conduktor-data` mounted to `/var/conduktor` (configs and logs)

### Nginx Override

A custom Nginx configuration (`conduktor-nginx-override.conf`) is included for Conduktor's internal reverse proxy, configuring buffer sizes, resolver settings, and cache headers.

---

## Setup and Deployment

This service is part of the OpenLDR v2 Turborepo monorepo. It is managed through npm scripts that integrate with the `turbo` build system.

### Quick Start

From the monorepo root:

```bash
# Pull all Docker images (including Kafka)
npm run docker:build

# Start all services
npm run docker:start

# Or target just the Kafka service
cd apps/openldr-kafka
npm run docker:start
```

### Lifecycle Commands

From the `apps/openldr-kafka` directory:

| Command | Description |
|---|---|
| `npm run docker:build` | Merge env files, run setup, and pull Docker images |
| `npm run docker:start` | Merge env files, start containers, create OpenSearch sink connector |
| `npm run docker:stop` | Merge env files, stop containers, delete OpenSearch sink connector |
| `npm run docker:reset` | Merge env files, tear down containers, remove images and volumes |
| `npm run setup:services` | Run the setup lifecycle hook (currently a no-op) |
| `npm run start:services` | Wait for Kafka Connect health, then create the OpenSearch sink connector |
| `npm run stop:services` | Delete the OpenSearch sink connector |
| `npm run reset:services` | Delete and recreate the OpenSearch sink connector |

### Startup Order

The services start in a dependency-aware order:

1. **Zookeeper** starts first
2. **Kafka broker** starts after Zookeeper and waits for health check (topic listing succeeds)
3. **Kafka Connect** starts after Kafka broker is healthy
4. **Conduktor Console** starts independently (depends on PostgreSQL externally)
5. **OpenSearch sink connector** is created via REST API after Kafka Connect is healthy (up to 120s wait)

---

## Docker Support

### Containers

| Container | Image | Memory Limit | Swap Limit |
|---|---|---|---|
| `openldr-kafka-zoo1` | `confluentinc/cp-zookeeper:7.7.1` | 2 GB (1 GB reserved) | 3 GB |
| `openldr-kafka1` | `confluentinc/cp-kafka:7.7.1` | 2 GB (1 GB reserved) | 3 GB |
| `openldr-kafka-connect` | `confluentinc/cp-kafka-connect:7.7.1` | 2 GB (1 GB reserved) | 3 GB |
| `openldr-kafka-conduktor-console` | `conduktor/conduktor-console:1.41.0` | 2 GB (1 GB reserved) | 3 GB |

### Volumes

| Volume | Purpose |
|---|---|
| `zoo-data` | Zookeeper data |
| `zoo-log` | Zookeeper transaction logs |
| `kafka-data` | Kafka broker log segments |
| `kafka-connect` | (declared but unused -- JARs are bind-mounted) |
| `conduktor-data` | Conduktor Console local data |

### Network

All containers join the `openldr-network` bridge network. Ports are not exposed to the host by default (commented out in `docker-compose.yml`). Access to services is routed through the OpenLDR gateway (Nginx reverse proxy).

### Health Checks

| Container | Check | Interval | Timeout | Start Period |
|---|---|---|---|---|
| `openldr-kafka1` | `kafka-topics --list` on internal listener | 30s | 10s | 60s |
| `openldr-kafka-connect` | `curl http://localhost:8083/` | 30s | 10s | 60s |

---

## Integration with Other Services

### MinIO (Producer)

MinIO is configured to emit S3 object-created event notifications directly to Kafka topics. Each bucket prefix maps to a specific topic:

| MinIO Bucket Prefix | Kafka ARN | Topic |
|---|---|---|
| `raw/` | `arn:minio:sqs::raw-kafka-notification:kafka` | `raw-inbound` |
| `validated/` | `arn:minio:sqs::validated-kafka-notification:kafka` | `validated-inbound` |
| `mapped/` | `arn:minio:sqs::mapped-kafka-notification:kafka` | `mapped-inbound` |
| `processed/` | `arn:minio:sqs::processed-kafka-notification:kafka` | `processed-inbound` |

### Data Processing Service (Consumer/Producer)

The `openldr-data-processing` service runs four consumer groups that form the pipeline:

- **openldr-validation-consumer**: consumes `raw-inbound`, produces to `validated-inbound`
- **openldr-mapper-consumer**: consumes `validated-inbound`, produces to `mapped-inbound`
- **openldr-storage-consumer**: consumes `mapped-inbound`, produces to `processed-inbound`
- **openldr-outpost-consumer**: consumes `processed-inbound`, delivers to external targets

All consumers use KafkaJS with broker address `openldr-kafka1:19092` (internal listener).

### OpenSearch (Sink)

The Kafka Connect OpenSearch sink writes pipeline events into OpenSearch indices for full-text search, dashboards, and observability. The connector targets the OpenSearch instance at `http://openldr-opensearch:9200`.

### PostgreSQL

Conduktor Console stores its metadata in the `conduktor_console` database on the shared OpenLDR PostgreSQL instance.

### Gateway (Nginx Reverse Proxy)

The OpenLDR gateway exposes Kafka services through subpath routing:

| Path | Backend |
|---|---|
| `/kafka/` | Kafka broker (`openldr-kafka1:9092`) |
| `/kafka-connect/` | Kafka Connect REST API (`openldr-kafka-connect:8083`) |
| `/kafka-console/` | Conduktor Console (`openldr-kafka-conduktor-console:8080`) |

---

## Monitoring and Management

### Conduktor Console UI

Access the Conduktor Console through the gateway at:

```
https://<HOST_IP>:443/kafka-console/
```

Default credentials:
- **Email**: Value of `KAFKA_CONDUKTOR_USERNAME` (default: `admin`)
- **Password**: Value of `KAFKA_CONDUKTOR_PASSWORD` (default: `Openldr123$`)

Features available through Conduktor:
- Browse and inspect topics, partitions, and consumer groups
- View messages in real time
- Manage Kafka Connect connectors
- Monitor consumer lag
- View cluster configuration

### JMX Metrics

The Kafka broker exposes JMX metrics on port `9001` for integration with monitoring tools (Prometheus JMX Exporter, Grafana, etc.).

### Kafka Connect REST API

The Kafka Connect REST API is available at:

```
https://<HOST_IP>:443/kafka-connect/
```

Useful endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/connectors` | GET | List all connectors |
| `/connectors/opensearch-sink` | GET | Get connector configuration |
| `/connectors/opensearch-sink/status` | GET | Check connector and task status |
| `/connectors/opensearch-sink` | DELETE | Remove the connector |
| `/connectors` | POST | Create a new connector |

---

## Troubleshooting

### Kafka broker not starting

- Verify Zookeeper is running: check `openldr-kafka-zoo1` container logs.
- Ensure sufficient memory is available (minimum 2 GB per container, 8 GB total for all four containers).
- Check the `DOCKER_HOST_IP` environment variable is set correctly.

### Kafka Connect fails to start

- Kafka Connect depends on a healthy Kafka broker. Check that `openldr-kafka1` passes its health check.
- Verify the plugin JARs exist in the `kafka-connect/` directory.
- Check container logs: `docker logs openldr-kafka-connect`.

### OpenSearch sink connector not created

- The connector is created programmatically during `npm run start:services`. It waits up to 120 seconds for Kafka Connect to be healthy.
- Verify Kafka Connect is reachable: `curl http://localhost:8083/` (or through the gateway).
- Check that OpenSearch is running and accessible at the configured URL.
- Review logs from the `openldr.ts start` command for error details.

### Conduktor Console not loading

- Conduktor requires a PostgreSQL database (`conduktor_console`). Ensure PostgreSQL is running and the database exists.
- Check that the gateway Nginx configuration is correctly proxying `/kafka-console/` requests.
- Review container logs: `docker logs openldr-kafka-conduktor-console`.

### Messages not flowing through the pipeline

1. Verify MinIO is configured with Kafka notifications (check MinIO service setup).
2. Confirm the Kafka broker is reachable on the internal listener (`openldr-kafka1:19092`).
3. Check consumer group lag in Conduktor Console.
4. Inspect dead-letter topics for failed messages.
5. Review data processing service logs for consumer errors.

### Resetting the environment

To completely reset Kafka and all its data:

```bash
cd apps/openldr-kafka
npm run docker:reset
```

This removes all containers, images, and volumes (including topic data and connector state).

---

## Project Structure

```
apps/openldr-kafka/
├── .dockerignore                    # Files excluded from Docker context
├── .env                             # Auto-generated merged environment variables
├── .gitignore                       # Git ignore rules
├── conduktor-data/                  # Conduktor Console persistent data
│   ├── configs/
│   └── log/
├── conduktor-nginx-override.conf    # Custom Nginx config for Conduktor
├── docker-compose.ts                # Docker Compose wrapper (v1/v2 compat)
├── docker-compose.yml               # Service definitions
├── kafka-connect/                   # Kafka Connect plugin JARs
│   ├── opensearch-connector-for-apache-kafka-3.1.1.jar
│   ├── opensearch-rest-high-level-client-2.9.0.jar
│   ├── ... (additional dependency JARs)
│   ├── licenses/
│   └── LICENSE
├── LICENSE                          # Apache License 2.0
├── openldr.ts                       # Lifecycle management script
├── package.json                     # npm package definition
└── tsconfig.json                    # TypeScript configuration
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.
