# OpenLDR MinIO - Object Storage Service

MinIO provides S3-compatible object storage for the OpenLDR platform. It serves as the central file storage layer for laboratory data payloads as they move through the data processing pipeline, and as the repository for all plugin artifacts (validation schemas, mappers, storage handlers, and outpost plugins).

## Architecture

OpenLDR MinIO sits at the core of the data ingestion and processing pipeline:

```
                          +-----------------+
                          |  openldr-gateway|
                          |  (Nginx proxy)  |
                          +--------+--------+
                                   |
                         /minio/   |   /minio-console/
                                   |
                          +--------v--------+
                          |  openldr-minio  |
                          |  (MinIO S3)     |
                          +--------+--------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
     Kafka Notifications    Plugin Storage      Bucket Events
              |                    |                    |
   +----------v------+   +--------v-------+   +--------v--------+
   | openldr-kafka   |   | openldr-data-  |   | openldr-entity- |
   | (event broker)  |   | processing     |   | services        |
   +-----------------+   +----------------+   +-----------------+
```

### Data Flow

1. Incoming lab data is placed into facility-specific buckets under prefix directories (`raw/`, `validated/`, `mapped/`, `processed/`).
2. Each prefix has a Kafka notification ARN. When an object is created under a prefix, MinIO publishes an event to the corresponding Kafka topic.
3. Downstream services consume these events and process the data through the pipeline stages.

| Bucket Prefix | Kafka Topic         | Purpose                              |
|---------------|---------------------|--------------------------------------|
| `raw/`        | `raw-inbound`       | Newly received, unvalidated payloads |
| `validated/`  | `validated-inbound` | Payloads that passed schema validation |
| `mapped/`     | `mapped-inbound`    | Payloads after terminology mapping   |
| `processed/`  | `processed-inbound` | Fully processed, ready for storage   |

### Integration with Other Services

| Service                    | Relationship                                                                 |
|----------------------------|------------------------------------------------------------------------------|
| **openldr-gateway**        | Nginx reverse proxy exposes MinIO API at `/minio/` and console at `/minio-console/` |
| **openldr-kafka**          | Receives bucket event notifications for pipeline orchestration               |
| **openldr-data-processing**| Reads and writes objects through the processing pipeline                     |
| **openldr-entity-services**| Manages buckets and objects; has elevated permissions (create/delete bucket)  |
| **openldr-internal-database** | Postgres stores plugin metadata seeded during MinIO initialization        |
| **openldr-keycloak**       | Part of the broader service mesh; shares the Docker network                  |

## Prerequisites

- **Node.js** >= 18
- **Docker** (with Docker Compose v2 or v1)
- **npm** 11.3.0+ (monorepo package manager)
- The following sibling services should be available on the `openldr-network`:
  - `openldr-kafka` (for bucket event notifications)
  - `openldr-postgres` (for plugin metadata seeding)

## Configuration

### Environment Variables

Environment variables are assembled from two sources during build/start:

1. **Base config**: `environments/.env.base` (shared across all services)
2. **Service-specific config**: `environments/.env.openldr-minio`

These are merged into a local `.env` file via the `copy:env` script.

| Variable                            | Default                                  | Description                          |
|-------------------------------------|------------------------------------------|--------------------------------------|
| `MINIO_ROOT_USER`                   | `minioadmin`                             | MinIO root administrator username    |
| `MINIO_ROOT_PASSWORD`               | `minioadmin`                             | MinIO root administrator password    |
| `MINIO_API_PORT`                    | `9000`                                   | S3-compatible API port               |
| `MINIO_CONSOLE_PORT`                | `9001`                                   | Web management console port          |
| `MINIO_BROWSER_REDIRECT_URL`        | `https://127.0.0.1:443/minio-console/`  | Console redirect URL (behind proxy)  |
| `MINIO_HOSTNAME`                    | `openldr-minio`                          | Container hostname on Docker network |
| `MINIO_ENDPOINT`                    | `http://openldr-minio:9000`              | Internal S3 endpoint for services    |
| `MINIO_REGION`                      | `us-east-1`                              | S3 region identifier                 |
| `INCLUDE_TEST_DATA`                 | `true`                                   | Seed test facility buckets and plugins |

### Service Accounts

Each consuming service has its own access key pair for least-privilege access:

| Service Account              | Env Key Prefix         | Policies                                                          |
|------------------------------|------------------------|-------------------------------------------------------------------|
| `data-processing-service`    | `DATA_PROCESSING`      | `object-control-policy`                                           |
| `validation-service`         | `VALIDATION`           | `object-control-policy`                                           |
| `mapper-service`             | `MAPPER`               | `object-control-policy`                                           |
| `external-storage-service`   | `EXTERNAL_STORAGE`     | `object-control-policy`                                           |
| `entity-services-service`    | `ENTITY_SERVICES`      | `object-control-policy`, `bucket-control-policy`, `bucket-delete-object-delete-policy` |
| `plugin-service`             | `PLUGIN`               | `object-control-policy`, `bucket-control-policy`, `bucket-delete-object-delete-policy` |

Access and secret keys follow the naming convention `<PREFIX>_MINIO_ACCESS_KEY` and `<PREFIX>_MINIO_SECRET_KEY`.

### IAM Policies

Located in `config/`:

| Policy File                             | Permissions                                           |
|-----------------------------------------|-------------------------------------------------------|
| `object-control-policy.json`            | `PutObject`, `GetObject`, `ListBucket`, `ListAllMyBuckets` |
| `bucket-control-policy.json`            | `CreateBucket`, `PutBucketNotification`, `GetBucketNotification` |
| `bucket-delete-object-delete-policy.json` | `DeleteObject`, `DeleteBucket`                       |

## Setup and Deployment

This service is part of the `openldr-v2` Turborepo monorepo. All commands should be run from the repository root unless stated otherwise.

### Full Stack (Recommended)

```bash
# From the monorepo root - build and start all services
npm run docker:build
npm run docker:start
```

### MinIO Only

```bash
# From apps/openldr-minio/
npm run docker:build    # Pull the MinIO image
npm run docker:start    # Start container + run initialization
npm run docker:stop     # Stop the container
npm run docker:reset    # Tear down container, volumes, and images
```

### What Happens on Start

The `start:services` script (`openldr.ts start`) performs the following initialization sequence:

1. Wait for MinIO container to become healthy (up to 120 s).
2. Install and configure the MinIO Client (`mc`) inside the container.
3. Create IAM policies from `config/*.json`.
4. Create service accounts and attach policies.
5. Configure Kafka bucket notifications for the four pipeline stages.
6. Restart MinIO to apply notification configuration.
7. Create the `plugins` bucket.
8. **Seed default plugins** -- upload bundled plugin files to MinIO and upsert metadata into Postgres.
9. **Seed built-in project** -- create a default project, use case, and data feed in Postgres with pre-assigned plugins.
10. Create the built-in project bucket with event notifications.
11. (If `INCLUDE_TEST_DATA=true`) Upload test plugins and create test facility buckets.
12. Final MinIO restart and health check.

## Docker

### Image

```
minio/minio:RELEASE.2025-02-28T09-55-16Z
```

### Container Details

| Property         | Value                                         |
|------------------|-----------------------------------------------|
| Container name   | `openldr-minio`                               |
| Command          | `server /data --console-address ":9001"`      |
| Restart policy   | `unless-stopped`                              |
| Volume           | `minio_data:/data`                            |
| Network          | `openldr-network` (bridge)                    |
| Health check     | `curl -f http://localhost:9000/minio/health/live` (10 s interval, 5 retries) |

> **Note:** Ports are not published to the host by default. Access MinIO through the `openldr-gateway` Nginx proxy at `/minio/` (API) and `/minio-console/` (web UI).

## Buckets

### System Buckets

| Bucket     | Purpose                                                                 |
|------------|-------------------------------------------------------------------------|
| `plugins`  | Stores all plugin artifacts (schemas, mappers, storage handlers, outpost plugins). Objects are keyed by `<pluginId>/<fileName>`. |

### Facility Buckets

Facility buckets are created dynamically based on project configuration. Each bucket is named by its project/facility ID and contains the four pipeline-stage prefixes (`raw/`, `validated/`, `mapped/`, `processed/`), each wired to its respective Kafka notification.

When `INCLUDE_TEST_DATA=true`, additional test facility buckets are provisioned.

## Default Plugins

The following bundled plugins are uploaded to the `plugins` bucket and registered in the database during initialization:

| Plugin Name            | Type        | Version | Status      | File                        |
|------------------------|-------------|---------|-------------|-----------------------------|
| `default-schema`       | validation  | 1.2.0   | active      | `default.schema.js`         |
| `default-schema`       | validation  | 1.1.0   | deprecated  | `default.schema.1.1.0.js`   |
| `default-mapper`       | mapping     | 1.2.0   | active      | `default.mapper.js`         |
| `default-storage`      | storage     | 1.2.0   | active      | `default.storage.js`        |
| `default-outpost`      | outpost     | 1.0.0   | active      | `default.outpost.js`        |
| `fhir-json-schema`     | validation  | 1.0.0   | active      | `fhir-json.schema.js`       |
| `hl7v2-schema`         | validation  | 1.0.0   | active      | `hl7v2.schema.js`           |
| `fhir-xml-schema`      | validation  | 1.0.0   | active      | `fhir-xml.schema.js`        |
| `csv-schema`           | validation  | 1.0.0   | active      | `csv.schema.js`             |
| `generic-xml-schema`   | validation  | 1.0.0   | active      | `generic-xml.schema.js`     |
| `binary-schema`        | validation  | 1.0.0   | active      | `binary.schema.js`          |
| `text-plain-schema`    | validation  | 1.0.0   | active      | `text-plain.schema.js`      |

Source files are located in the `default-plugins/` directory, organized by type (`schema/`, `mapper/`, `storage/`, `outpost/`).

## API Endpoints

MinIO exposes a standard S3-compatible API on port `9000`. Through the gateway proxy:

| Path              | Target         | Description                     |
|-------------------|----------------|---------------------------------|
| `/minio/`         | MinIO API :9000 | S3-compatible REST API         |
| `/minio-console/` | MinIO UI :9001  | Web-based management console   |

### Health Check

```
GET http://openldr-minio:9000/minio/health/live
```

Returns HTTP 200 when the service is healthy.

## Directory Structure

```
apps/openldr-minio/
  config/
    bucket-control-policy.json          # IAM policy for bucket operations
    bucket-delete-object-delete-policy.json  # IAM policy for delete operations
    object-control-policy.json          # IAM policy for object CRUD
    test-files/                         # Sample payloads for testing
  default-plugins/
    mapper/                             # Default mapping plugins
    outpost/                            # Default outpost plugins
    schema/                             # Default validation schema plugins
    storage/                            # Default storage plugins
  docker-compose.ts                     # Docker Compose CLI wrapper
  docker-compose.yml                    # Container definition
  openldr.ts                            # Lifecycle management (setup/start/stop/reset)
  package.json                          # Package config and npm scripts
  .env                                  # Generated env file (not committed)
```

## Troubleshooting

### MinIO container fails to start

Check Docker logs:

```bash
docker logs openldr-minio
```

Verify the container is on the correct network:

```bash
docker network inspect openldr_openldr-network
```

### Health check failures

The health check endpoint is `http://localhost:9000/minio/health/live`. If the container shows as unhealthy:

```bash
docker exec openldr-minio curl -f http://localhost:9000/minio/health/live
```

### Initialization script fails

The `openldr.ts start` script depends on several other containers being up:

- **openldr-minio** must be healthy before initialization begins (120 s timeout).
- **openldr-kafka** must be running for Kafka notification configuration.
- **openldr-postgres** must be running for plugin metadata seeding.

Check initialization output:

```bash
npm run start:services
```

### Cannot access MinIO console

The console is proxied through the gateway. Ensure:

1. The gateway container (`openldr-gateway`) is running.
2. Access the console at `https://127.0.0.1:443/minio-console/`.
3. Default credentials: `minioadmin` / `minioadmin`.

### Bucket event notifications not working

Verify Kafka notifications are configured:

```bash
docker exec openldr-minio mc admin info myminio
docker exec openldr-minio mc event list myminio/<bucket-name>
```

Ensure the MinIO container was restarted after notification configuration (the initialization script does this automatically).

### Permission denied errors from a service

Each service uses its own access key with specific IAM policies. Verify the service account exists and has the correct policies attached:

```bash
docker exec openldr-minio mc admin user list myminio
docker exec openldr-minio mc admin policy entities myminio --user <service-name>
```

## License

Apache License 2.0
