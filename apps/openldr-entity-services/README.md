# OpenLDR Entity Services

The **Entity Services** microservice is the primary API layer for the [OpenLDR](https://github.com/openldr) platform. It acts as the backend-for-frontend (BFF) for the OpenLDR Studio UI and as the management plane for all domain entities -- projects, facilities, users, plugins, extensions, terminology, laboratory reports, and dashboards. The service exposes a RESTful API under the `/api/v1` prefix and integrates with PostgreSQL, MinIO (S3-compatible object storage), Keycloak (identity & access management), OpenSearch, and the Open Concept Lab (OCL).

## Architecture

```
                         +---------------------+
  Studio UI ----------> |  Entity Services    |
  Extensions ---------> |  (Express / Node)   |
                         +-----+------+-------+
                               |      |
               +---------------+      +----------------+
               |                                        |
        +------+-------+                      +---------+--------+
        | PostgreSQL   |                      | MinIO (S3)       |
        | openldr      | (internal)           | plugins, exts,   |
        | openldr_ext  | (external / lab)     | file storage     |
        +--------------+                      +------------------+
               |
        +------+-------+     +-----------------+     +--------------+
        | Keycloak     |     | OpenSearch      |     | OCL API      |
        | (Auth/IAM)   |     | (Audit / Logs)  |     | (Terminology)|
        +--------------+     +-----------------+     +--------------+
```

This service is part of the **openldr-v2** Turborepo monorepo alongside 13 other apps and shared packages.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 18 (Alpine in Docker) |
| Language | TypeScript (ESM) |
| Framework | Express 4 |
| Database | PostgreSQL (two pools: `openldr` internal + `openldr_external` lab data) |
| Object Storage | MinIO / S3 (`@aws-sdk/client-s3`, `minio` client) |
| Identity | Keycloak (OIDC, JWT verification, user management) |
| Search | OpenSearch |
| Terminology | Open Concept Lab (OCL) |
| Validation | Zod, jsonschema |
| Logging | Pino, Morgan |
| Security | Helmet, CORS, express-rate-limit |
| Build / Monorepo | Turborepo, tsx |
| Package Manager | npm 11 (workspaces) |

## API Endpoints Overview

All endpoints are prefixed with `/api/v1` unless otherwise noted. Detailed per-domain documentation with request/response examples lives in the [`docs/`](./docs/) folder.

### Root & Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | None | Service info and endpoint index |
| `GET` | `/health` | None | Health check -- verifies database connectivity |
| `GET` | `/api-doc/:format` | None | API documentation (JSON or YAML, placeholder) |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/users` | None | List all users (supports query filters) |
| `GET` | `/api/v1/users/:userId` | None | Get a user by ID |
| `POST` | `/api/v1/users` | None | Create a new user |
| `PUT` | `/api/v1/users/:userId` | None | Update a user |
| `DELETE` | `/api/v1/users/:userId` | None | Delete a user |

See [docs/users-api.md](./docs/users-api.md)

### Storage (MinIO)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/storage/upload` | None | Upload a file (multipart) |
| `GET` | `/api/v1/storage/download/:bucket/:key` | None | Download a file |
| `DELETE` | `/api/v1/storage/file/:bucket/:key` | None | Delete a file |
| `POST` | `/api/v1/storage/bucket` | None | Create a bucket |
| `DELETE` | `/api/v1/storage/bucket/:bucketName` | None | Delete a bucket |
| `GET` | `/api/v1/storage/bucket/:bucketName/stats` | None | Get bucket statistics |
| `GET` | `/api/v1/storage/bucket/:bucketName/exists` | None | Check if a bucket exists |
| `GET` | `/api/v1/storage/buckets` | None | List all buckets |
| `POST` | `/api/v1/storage/bucket/:bucketName/ensure` | None | Ensure a bucket exists (create if missing) |
| `POST` | `/api/v1/storage/bucket/validate` | None | Validate a bucket name |
| `POST` | `/api/v1/storage/bucket/generate` | None | Generate a bucket name from a lab code |
| `POST` | `/api/v1/storage/file/hash` | None | Calculate SHA hash for an uploaded file |

See [docs/storage-api.md](./docs/storage-api.md)

### Extensions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/extensions` | API Key | List all extensions (registry) |
| `GET` | `/api/v1/extensions/:id` | API Key | Get a single extension manifest |
| `GET` | `/api/v1/extensions/:id/code` | API Key | Download extension payload (JS/HTML) |
| `GET` | `/api/v1/extensions/:id/permissions` | API Key | Get extension permissions list |
| `POST` | `/api/v1/extensions` | Bearer + Admin | Publish an extension (ZIP upload) |
| `GET` | `/api/v1/extensions/user` | Bearer | List current user's installed extensions |
| `POST` | `/api/v1/extensions/user/:id` | Bearer | Install an extension for current user |
| `DELETE` | `/api/v1/extensions/user/:id` | Bearer | Uninstall an extension |
| `PATCH` | `/api/v1/extensions/user/:id` | Bearer | Update extension settings |

See [docs/extensions-api.md](./docs/extensions-api.md)

### Plugins

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/plugin/plugins` | None | List all plugins |
| `GET` | `/api/v1/plugin/get-plugins?pluginType=` | None | List plugins filtered by type |
| `GET` | `/api/v1/plugin/get-plugin/:id` | None | Get plugin with file content |
| `POST` | `/api/v1/plugin/create-plugin` | None | Create a plugin (file upload) |
| `POST` | `/api/v1/plugin/create-mapper-plugin` | None | Create a mapper plugin from OCL |
| `PUT` | `/api/v1/plugin/update-plugin/:id` | None | Update a plugin (file upload) |
| `PUT` | `/api/v1/plugin/update-mapper-plugin/:id` | None | Update a mapper plugin |
| `DELETE` | `/api/v1/plugin/delete-plugin/:id` | None | Delete a plugin |
| `POST` | `/api/v1/plugin/regenerate-mapper-plugin/:id` | None | Regenerate mapper from OCL |

See [docs/plugins-api.md](./docs/plugins-api.md)

### Archives (Dynamic CRUD)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/archives/tables` | None | List all database tables |
| `GET` | `/api/v1/archives/table/:name` | None | Get column definitions for a table |
| `POST` | `/api/v1/archives/data/:name` | None | Query rows from a table (with filters, pagination) |
| `POST` | `/api/v1/archives/table/:version/:name/:type` | None | Create a record (validated against form schema) |
| `PUT` | `/api/v1/archives/table/:version/:name/:type` | None | Update a record (validated against form schema) |
| `DELETE` | `/api/v1/archives/table/:version/:name/:type` | None | Delete record(s) by primary key |

See [docs/archives-api.md](./docs/archives-api.md)

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/dashboard` | None | Full aggregated dashboard data |
| `GET` | `/api/v1/dashboard/laboratory` | None | Laboratory-specific dashboard (KPIs, charts) |
| `GET` | `/api/v1/dashboard/infrastructure` | None | Infrastructure dashboard (pipeline, storage) |

See [docs/dashboard-api.md](./docs/dashboard-api.md)

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/reports/antibiogram` | None | Antibiogram resistance rates (WHO GLASS compliant) |
| `GET` | `/api/v1/reports/priority-pathogens` | None | WHO priority pathogen surveillance |
| `GET` | `/api/v1/reports/surveillance` | None | AMR surveillance (MRSA, carbapenem, ESBL trends) |
| `GET` | `/api/v1/reports/workload` | None | Lab workload volumes and turnaround times |
| `GET` | `/api/v1/reports/geographic` | None | Geographic AMR distribution by facility |
| `GET` | `/api/v1/reports/data-quality` | None | Data quality and import batch statistics |

See [docs/reports-api.md](./docs/reports-api.md)

### Query Engine

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/query/engine` | Bearer | Execute a data query (for extensions) |
| `POST` | `/api/v1/query/engine/storage/get` | Bearer | Get extension storage value |
| `POST` | `/api/v1/query/engine/storage/set` | Bearer | Set extension storage value |
| `POST` | `/api/v1/query/engine/storage/delete` | Bearer | Delete extension storage value |

See [docs/query-engine-api.md](./docs/query-engine-api.md)

### Concepts (Coding Systems & Terminology)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/concepts/systems` | None | List coding systems |
| `GET` | `/api/v1/concepts/systems/:id` | None | Get coding system by ID |
| `GET` | `/api/v1/concepts/systems/code/:code` | None | Get coding system by code |
| `GET` | `/api/v1/concepts/systems/:id/stats` | None | Get coding system statistics |
| `POST` | `/api/v1/concepts/systems` | None | Create a coding system |
| `PUT` | `/api/v1/concepts/systems/:id` | None | Update a coding system |
| `DELETE` | `/api/v1/concepts/systems/:id` | None | Delete a coding system |
| `GET` | `/api/v1/concepts/concepts` | None | List concepts by system |
| `GET` | `/api/v1/concepts/concepts/search` | None | Full-text concept search |
| `GET` | `/api/v1/concepts/concepts/classes/:systemId` | None | List concept classes |
| `GET` | `/api/v1/concepts/concepts/:id` | None | Get concept by ID |
| `GET` | `/api/v1/concepts/concepts/:id/mappings` | None | Get concept mappings |
| `POST` | `/api/v1/concepts/concepts` | None | Create a concept |
| `PUT` | `/api/v1/concepts/concepts/:id` | None | Update a concept |
| `DELETE` | `/api/v1/concepts/concepts/:id` | None | Delete a concept |
| `POST` | `/api/v1/concepts/mappings` | None | Create a concept mapping |
| `PUT` | `/api/v1/concepts/mappings/:id` | None | Update a concept mapping |
| `DELETE` | `/api/v1/concepts/mappings/:id` | None | Delete a concept mapping |

See [docs/concepts-api.md](./docs/concepts-api.md)

### Terminology

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/terminology/generate` | None | Generate terminology mapping from OCL |

### OpenSearch

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/opensearch?index=` | None | Get unique data feeds, projects, and use cases |
| `GET` | `/api/v1/opensearch/index-document-count` | None | Get document counts per index |
| `GET` | `/api/v1/opensearch/interval-message-count` | None | Get message counts by time interval |
| `GET` | `/api/v1/opensearch/latest-messages` | None | Get latest messages |

### Forms

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/forms/:type` | None | List all entry forms by type |
| `GET` | `/api/v1/forms/form/:name/:version/:type` | None | Get a specific entry form schema |

## Authentication & Authorization

The service implements a layered security model:

### 1. Keycloak JWT (Bearer Token)

Routes protected with `requireAuth` verify the JWT against the Keycloak realm. The decoded token populates `req.user` with:

```typescript
{
  id: string;          // Keycloak subject ID
  username: string;    // preferred_username
  email: string;
  roles: string[];     // Combined realm + client roles
  isAdmin: boolean;    // true if user has "admin" or "realm-admin" role
}
```

Routes that additionally use `requireAdmin` enforce the admin role check.

### 2. API Key

Routes protected with `requireApiKey` accept either:
- `X-API-Key` header
- `Authorization: Bearer <key>` header

When `API_KEY` is not set in the environment, API key auth is disabled (dev mode).

### 3. Rate Limiting

Three rate-limit tiers are applied:

| Tier | Window | Max Requests | Applied To |
|------|--------|-------------|------------|
| General | 60s | 120 | All routes (global) |
| Registry | 60s | 60 | Extension listing |
| Code Load | 60s | 30 | Extension payload download |

### 4. Extension Permissions

The Query Engine enforces per-extension permission checks. Extensions must be installed by the user, and the user must have approved the required permissions:

- `data.query` -- broad query access
- `data.patients`, `data.labRequests`, `data.labResults` -- table-level access
- `storage.read`, `storage.write` -- extension key-value storage

## Prerequisites

- **Node.js** >= 18
- **npm** >= 11
- **Docker** and **Docker Compose** (for containerized deployment)
- Running instances of:
  - PostgreSQL (databases: `openldr`, `openldr_external`)
  - MinIO
  - Keycloak
  - OpenSearch (optional, for audit/log endpoints)
  - OCL API (optional, for terminology generation)

## Configuration

Configuration is driven entirely by environment variables. The `.env` file is assembled at build time by merging several environment fragments from the monorepo root:

### Key Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENTITY_SERVICES_PORT` | `3002` | Port the service listens on |
| `NODE_ENV` | `production` | `development` uses localhost for DB, Keycloak |
| `POSTGRES_HOSTNAME` | `openldr-postgres` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_DB` | `openldr` | Internal database name |
| `POSTGRES_DB_EXTERNAL` | `openldr_external` | External (lab data) database name |
| `MINIO_ENDPOINT` | `http://openldr-minio:9000` | MinIO endpoint URL |
| `MINIO_ROOT_USER` | `minioadmin` | MinIO access key |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | MinIO secret key |
| `MINIO_REGION` | `us-east-1` | MinIO region |
| `KEYCLOAK_BASE_URL` | -- | Keycloak base URL (internal) |
| `KEYCLOAK_PUBLIC_URL` | -- | Keycloak public URL (used in dev) |
| `KEYCLOAK_REALM` | `openldr-realm` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | `openldr-client` | Keycloak client ID |
| `KEYCLOAK_CLIENT_SECRET` | -- | Keycloak client secret |
| `OCL_BASE_URL` | `https://openconceptlab-api:8000` | Open Concept Lab API |
| `OPENSEARCH_HOSTNAME` | `openldr-opensearch` | OpenSearch host |
| `OPENSEARCH_PORT` | `9200` | OpenSearch port |
| `QUERY_MODE` | `direct` | Query engine mode: `direct` or `proxy` |
| `API_KEY` | (empty) | API key for protected routes (empty = disabled) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |

## Setup & Running

### Local Development

```bash
# From monorepo root
npm install

# Copy/merge environment files
cd apps/openldr-entity-services
npm run copy:env

# Start in dev mode (with hot reload via tsx watch)
npm run dev
```

The service starts at `http://localhost:3002` by default.

### Production

```bash
npm run start
```

## Docker

### Build

```bash
# From the app directory
npm run docker:build

# Or from monorepo root (all services)
npm run docker:build
```

The Dockerfile uses a multi-stage build:
1. **Builder** -- installs Turbo, prunes the workspace to only this service's dependencies
2. **Installer** -- installs dependencies, runs the Turbo build
3. **Runner** -- minimal Alpine image, copies built artifacts, runs `npm start`

### Run

```bash
npm run docker:start    # Start container
npm run docker:stop     # Stop container
npm run docker:reset    # Remove container, images, and volumes
```

### Docker Compose

The `docker-compose.yml` defines a single service:

```yaml
services:
  openldr-entity-services:
    image: openldr-entity-services:latest
    container_name: openldr-entity-services
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - openldr-network
```

The service connects to the shared `openldr-network` bridge to communicate with other containers.

## Request/Response Examples

### Health Check

```bash
curl http://localhost:3002/health
```

```json
{
  "status": "ok",
  "uptime": 12345.67,
  "db": "connected",
  "version": "2.0.0"
}
```

### List Users

```bash
curl http://localhost:3002/api/v1/users
```

```json
{
  "success": true,
  "data": [
    {
      "userId": "a1b2c3d4-...",
      "email": "lab.tech@hospital.org",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  ]
}
```

### Upload a File

```bash
curl -X POST http://localhost:3002/api/v1/storage/upload \
  -F "file=@results.csv" \
  -F "bucket=my-lab-bucket"
```

```json
{
  "success": true,
  "data": {
    "bucket": "my-lab-bucket",
    "key": "results.csv",
    "path": "my-lab-bucket/results.csv",
    "size": 10240,
    "hash": "sha256-abc123...",
    "originalName": "results.csv"
  }
}
```

### Query Lab Results (Extension Query Engine)

```bash
curl -X POST http://localhost:3002/api/v1/query/engine \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Extension-Id: my-extension" \
  -H "Content-Type: application/json" \
  -d '{
    "schema": "external",
    "table": "lab_results",
    "params": {
      "filters": { "organism_code": { "eq": "ECOLI" } },
      "page": 1,
      "limit": 50,
      "sort": { "field": "specimen_date", "direction": "desc" }
    }
  }'
```

### Publish an Extension (Admin)

```bash
curl -X POST http://localhost:3002/api/v1/extensions \
  -H "Authorization: Bearer <admin-jwt>" \
  -F "bundle=@my-extension.zip"
```

The ZIP must contain `manifest.json` and either `index.js` (worker) or `index.html` (iframe).

```json
{
  "id": "my-extension",
  "version": "1.0.0",
  "kind": "worker",
  "integrity": "sha256-xyz...",
  "storageKey": "extensions/my-extension/1.0.0/payload",
  "publishedAt": "2026-03-16T10:00:00.000Z"
}
```

### Get Antibiogram Report

```bash
curl "http://localhost:3002/api/v1/reports/antibiogram?date_from=2025-01-01&date_to=2025-06-30&min_isolates=30"
```

```json
{
  "metadata": {
    "facility": "All Facilities",
    "date_range": "2025-01-01 - 2025-06-30",
    "guideline": "All guidelines",
    "generated_at": "2026-03-16"
  },
  "data": [
    {
      "organism_code": "ECOLI",
      "organism_name": "Escherichia coli",
      "antibiotic_code": "CTX",
      "antibiotic_name": "Cefotaxime",
      "total_tested": 250,
      "resistant": 45,
      "intermediate": 5,
      "susceptible": 200,
      "resistance_pct": 18.0
    }
  ]
}
```

## Error Handling

The service uses a consistent error response format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "status": 400
}
```

Standard error codes:

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Bearer token / API key |
| `FORBIDDEN` | 403 | Insufficient role or permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `CORS_VIOLATION` | 403 | Origin not in allowed list |
| `STORAGE_ERROR` | 502 | MinIO storage operation failed |
| `UPSTREAM_ERROR` | 502 | Proxy mode: upstream API unreachable |
| `QUERY_ERROR` | 400/500 | Query engine SQL error |
| `SERVER_ERROR` | 500 | Unhandled internal error |

A global error handler catches unhandled exceptions and returns a 500 with a structured JSON body. All errors are logged via Pino.

## Integration with Other OpenLDR Services

| Service | Integration |
|---|---|
| **PostgreSQL** (`openldr-postgres`) | Two connection pools: `openldr` for internal entities (projects, plugins, extensions, users, forms) and `openldr_external` for lab data (patients, lab_requests, lab_results, isolates, susceptibility_tests) |
| **MinIO** (`openldr-minio`) | Object storage for plugin files, extension payloads, and general file uploads. Bucket-level Kafka notifications are configured when projects are created |
| **Keycloak** (`openldr-keycloak`) | JWT token verification for protected routes; user CRUD operations are mirrored to Keycloak (create/update/delete) |
| **OpenSearch** (`openldr-opensearch`) | Audit trail and data pipeline monitoring -- document counts, message intervals, latest messages |
| **Open Concept Lab** | Terminology mapping generation -- fetches concepts and mappings from OCL organizations/sources |
| **Data Processing** (`openldr-data-processing`) | Sibling service handling data ingestion; entity services manages the configuration (projects, data feeds, use cases) that data processing consumes |
| **Gateway** (`openldr-gateway`) | APISIX API gateway reverse-proxies external traffic to this service at `/entity-services` |

## Project Structure

```
src/
  controllers/          # Express route handlers (one file per domain)
    archive.controller.ts
    concept.controller.ts
    dashboard.controller.ts
    extension.controller.ts
    form.controller.ts
    opensearch.controller.ts
    plugin.controller.ts
    query.engine.controller.ts
    report.controller.ts
    storage.controller.ts
    terminology.controller.ts
    user.controller.ts
  services/             # Business logic and external service clients
    concept.service.ts
    dashboard.service.ts
    form.service.ts
    keycloak.service.ts
    minio.service.ts
    ocl.service.ts
    opensearch.service.ts
    plugin.service.ts
    user.service.ts
  lib/                  # Shared utilities
    db.ts               # PostgreSQL connection pools and query helpers
    jwt.ts              # JWT token decoding utilities
    logger.ts           # Pino logger factory
    minio-client.ts     # MinIO client singleton
    minio.ts            # MinIO helper functions
    query-engine.ts     # SQL query builder for the extension query engine
    storage.ts          # Extension payload storage (MinIO)
    utils.ts            # General utilities
    validator.ts        # JSON Schema validator
  middleware/
    security.ts         # Helmet, CORS, rate limiting, auth middleware
  types/
    index.ts            # TypeScript interfaces and type definitions
  index.ts              # Application entry point and route registration
```

## License

This project is licensed under the terms specified in the [LICENSE](./LICENSE) file.
