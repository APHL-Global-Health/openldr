# OpenLDR External Database

An Express.js REST API service that provides external access to the OpenLDR (Open Laboratory Data Repository) external database. This service acts as the public-facing data layer, exposing laboratory data -- including lab requests, results, patients, and analytical queries -- through a versioned API, while the internal database remains reserved for system operations, user management, and configuration.

## Internal vs External Database

OpenLDR uses a **dual-database architecture**:

| Aspect | Internal Database (`openldr`) | External Database (`openldr_external`) |
|---|---|---|
| **Purpose** | System operations, user management, configuration, extension state | Laboratory data repository -- patients, requests, results, terminology, AMR |
| **Access** | Backend services only | Exposed via this REST API |
| **Schema style** | Application tables (camelCase, enums) | Analytics-optimized (snake_case, JSONB, GIN indexes, views) |
| **Key tables** | Users, extensions, system config | `patients`, `lab_requests`, `lab_results`, `isolates`, `susceptibility_tests`, terminology layers |
| **Design philosophy** | Operational OLTP | Multi-source ingestion, OCL-inspired terminology, columnar core + JSONB extensibility |

The external database is designed for multi-source data ingestion from various Laboratory Information Systems (LIS), supporting HL7 v2, FHIR, CSV, WHONET, ASTM, and manual uploads. It includes a full AMR (Antimicrobial Resistance) extension layer for microbiology data.

## Tech Stack

- **Runtime:** Node.js (>= 18) with TypeScript
- **Framework:** Express.js 4.x
- **Database:** PostgreSQL (via `pg` / `pg-pool`)
- **Logging:** Pino (with `pino-pretty` for development)
- **Security:** Helmet, CORS, express-rate-limit
- **Other:** Compression, Morgan (HTTP logging), Multer (file uploads), Axios, MinIO client
- **Build:** tsx (TypeScript execution), Turbo (monorepo orchestration)
- **Containerization:** Docker (multi-stage Alpine build)

## Database Schema Overview

The external database (`openldr_external`) is organized into eight layers. The schema is defined in the migration file at `apps/openldr-internal-database/migrations/02-openldr_external.sql`.

### Layer 1: Terminology and Mapping (OCL-Inspired)

Lightweight, self-contained terminology layer inspired by the Open Concept Lab (OCL).

#### `coding_systems`

Registry of vocabularies and code systems.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `system_code` | VARCHAR(50) | Unique code (e.g. `LOINC`, `ICD10`, `WHONET_ORG`) |
| `system_name` | VARCHAR(255) | Human-readable name |
| `system_uri` | TEXT | Canonical URI |
| `system_version` | VARCHAR(50) | Version string |
| `system_type` | VARCHAR(30) | `external`, `internal`, or `local` |
| `description` | TEXT | Free-text description |
| `owner` | VARCHAR(255) | Maintaining organization |
| `metadata` | JSONB | Extensible metadata |
| `is_active` | BOOLEAN | Active flag |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

Seeded systems: LOINC, ICD-10, ICD-11, SNOMED-CT, WHONET (ORG/ABX/SPEC), HL7 v2, ATC, LOCAL, AMR (MO/AB/AV).

#### `concepts`

Individual codes within a coding system.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `system_id` | UUID (FK) | References `coding_systems` |
| `concept_code` | VARCHAR(100) | The actual code value |
| `display_name` | VARCHAR(500) | Preferred human-readable name |
| `concept_class` | VARCHAR(100) | Class: `test`, `panel`, `organism`, `antibiotic`, `specimen`, `diagnosis` |
| `datatype` | VARCHAR(50) | `numeric`, `coded`, `text`, `datetime` |
| `properties` | JSONB | Extensible attributes |
| `names` | JSONB | Multilingual names array |
| `is_active` | BOOLEAN | Active flag |
| `retired` | BOOLEAN | Retirement flag |
| `replaced_by` | UUID (FK) | Replacement concept |

#### `concept_mappings`

Cross-walks between codes in different systems (SAME-AS, NARROWER-THAN, BROADER-THAN, etc.).

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `from_concept_id` | UUID (FK) | Source concept |
| `to_concept_id` | UUID (FK) | Target concept (NULL if external only) |
| `to_system_code` | VARCHAR(50) | Fallback external system code |
| `to_concept_code` | VARCHAR(100) | Fallback external concept code |
| `to_concept_name` | VARCHAR(500) | Fallback display name |
| `map_type` | VARCHAR(50) | `SAME-AS`, `NARROWER-THAN`, `BROADER-THAN`, `RELATED-TO` |

### Layer 2: Facilities

#### `facilities`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `facility_concept_id` | UUID (FK) | Link to terminology layer |
| `facility_code` | VARCHAR(50) | Unique facility code |
| `facility_name` | VARCHAR(255) | Human-readable name |
| `facility_type` | VARCHAR(50) | `hospital`, `national_ref`, `district`, `private`, `research` |
| `country_code` | VARCHAR(3) | ISO 3166-1 alpha-3 |
| `region` / `district` / `province` / `city` | VARCHAR | Geographic hierarchy |
| `contact` | JSONB | Contact details |
| `lims_vendor` | VARCHAR(100) | LIS system in use |
| `metadata` | JSONB | Accreditation, MinIO bucket, etc. |

### Layer 3: Data Provenance

#### `data_sources`

Registered external systems that feed data into OpenLDR.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `source_code` | VARCHAR(100) | Unique source identifier |
| `source_type` | VARCHAR(50) | `hl7_v2`, `hl7_fhir`, `csv`, `whonet_sqlite`, `astm`, `api`, `manual` |
| `facility_id` | UUID (FK) | Associated facility |
| `config` | JSONB | Connection details, field mapping references |

#### `import_batches`

Tracks every ingest run.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `data_source_id` | UUID (FK) | Source reference |
| `batch_status` | VARCHAR(20) | `pending`, `processing`, `completed`, `failed`, `partial` |
| `filename` | VARCHAR(500) | Original file name |
| `file_hash` | VARCHAR(128) | SHA-256 for deduplication |
| `file_storage_path` | TEXT | MinIO / S3 path |
| `records_total` / `records_success` / `records_failed` | INTEGER | Processing counts |
| `error_log` | JSONB | Error details |

#### `field_mappings`

How source-system fields map to OpenLDR columns (replaces hard-coded ETL logic).

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `data_source_id` | UUID (FK) | Source reference |
| `mapping_name` | VARCHAR(255) | Mapping profile name |
| `rules` | JSONB | Array of mapping rules with transforms |

### Layer 4: Core Lab Data

#### `patients`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `patient_guid` | VARCHAR(255) | External patient identifier from source |
| `facility_id` | UUID (FK) | Associated facility |
| `surname` / `firstname` | VARCHAR | Demographics |
| `date_of_birth` | DATE | Date of birth |
| `sex` | CHAR(1) | `M`, `F`, `U`, `O` |
| `national_id` | VARCHAR(50) | National identifier |
| `encrypted_patient_id` | VARCHAR(128) | Hashed ID for de-identified analytics |
| `patient_data` | JSONB | Full original payload |
| `import_batch_id` | UUID (FK) | Provenance link |

#### `lab_requests`

One row per test-panel order (maps to HL7 OBR segment).

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `patient_id` | UUID (FK) | Patient reference |
| `facility_id` | UUID (FK) | Facility reference |
| `request_id` | VARCHAR(255) | LIS accession / request number |
| `obr_set_id` | INTEGER | HL7 OBR set ID |
| `panel_concept_id` | UUID (FK) | Resolved panel concept |
| `panel_code` / `panel_desc` | VARCHAR | Raw panel identification |
| `specimen_datetime` | TIMESTAMPTZ | Specimen collection time |
| `specimen_concept_id` | UUID (FK) | Resolved specimen type |
| `priority` | CHAR(1) | HL7 priority: S, R, A |
| `clinical_info` | TEXT | Clinical context |
| `section_code` | VARCHAR(10) | HL7 section: CH, HM, MB |
| `result_status` | CHAR(1) | F=final, P=preliminary, C=corrected |
| `request_data` | JSONB | Full original request payload |
| `mappings` | JSONB | Resolved concept mappings cache |

#### `lab_results`

One row per observation / test result (maps to HL7 OBX segment).

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `request_id` | UUID (FK) | Parent lab request (CASCADE delete) |
| `obx_set_id` / `obx_sub_id` | INTEGER | HL7 OBX set and sub IDs |
| `observation_concept_id` | UUID (FK) | Resolved LOINC / local concept |
| `observation_code` / `observation_desc` | VARCHAR | Raw observation identification |
| `result_type` | VARCHAR(10) | `NM` (numeric), `CE` (coded), `ST` (string), `DT` (datetime) |
| `numeric_value` | NUMERIC(15,5) | Numeric result |
| `coded_value` | VARCHAR(50) | Coded result (pos/neg, organism codes) |
| `text_value` | TEXT | Free-text result |
| `abnormal_flag` | VARCHAR(10) | HL7 flags: H, L, HH, LL, A, N |
| `rpt_result` / `rpt_units` / `rpt_flag` / `rpt_range` | VARCHAR/TEXT | Reported result as LIS formatted it |
| `result_timestamp` | TIMESTAMPTZ | When result was finalized |
| `result_data` | JSONB | Full original result payload |

### Layer 5: AMR Extension

Optional tables populated only for microbiology / culture / AST data.

#### `isolates`

One row per organism isolated from a specimen.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `lab_result_id` | UUID (FK) | Source lab result (CASCADE delete) |
| `request_id` | UUID (FK) | Parent request |
| `organism_concept_id` | UUID (FK) | Resolved WHONET/SNOMED organism |
| `organism_code` / `organism_name` | VARCHAR | Raw organism identification |
| `organism_type` | VARCHAR(50) | `bacteria`, `fungus`, `virus`, `parasite` |
| `beta_lactamase` / `esbl` / `carbapenemase` / `mrsa_screen` | VARCHAR | Resistance markers |
| `ward` / `ward_type` / `origin` | VARCHAR | Clinical context for AMR analytics |

#### `susceptibility_tests`

One row per isolate + antibiotic tested (S / I / R interpretations).

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated identifier |
| `isolate_id` | UUID (FK) | Parent isolate (CASCADE delete) |
| `antibiotic_concept_id` | UUID (FK) | Resolved antibiotic concept |
| `antibiotic_code` | VARCHAR(50) | Raw code (e.g. `AMK`, `CIP`) |
| `test_method` | VARCHAR(20) | `disk_diffusion`, `mic`, `etest`, `agar_dilution` |
| `result_raw` | VARCHAR(100) | Original value |
| `result_numeric` | NUMERIC(10,3) | Parsed numeric value |
| `interpretation` | VARCHAR(5) | S, I, R, SDD, NS |
| `guideline` / `guideline_version` | VARCHAR | CLSI, EUCAST, etc. |

#### `breakpoints`

CLSI/EUCAST interpretation criteria per organism + antibiotic + method.

#### `qc_ranges`

Expected QC ranges for ATCC reference strains.

#### `dosage`

EUCAST standard/high dosage recommendations per antibiotic.

#### `intrinsic_resistance`

Organism + antibiotic intrinsic resistance pairs (auto-flag impossible susceptibility results).

#### `organism_groups`

Organism complex/group memberships for breakpoint matching.

### Layer 6: Triggers and Functions

- Auto-update `updated_at` triggers on all major tables.

### Layer 7: Analytics Views

- **`vw_facility_summary`** -- Facility-level summary: total requests, results, isolates, date ranges.
- **`vw_resistance_rates`** -- AMR resistance rate by organism + antibiotic (the core AMR analytics query).
- **`vw_concept_crosswalk`** -- All mappings for a concept in one row.

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Health and Info

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | API info and version |
| `GET` | `/health` | Health check with uptime |

### Patients (`/api/v1/patients`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a new patient (idempotent) |
| `GET` | `/` | List patients with filtering and pagination |
| `GET` | `/:id` | Get a specific patient by ID |
| `PUT` | `/:id` | Update patient data |
| `DELETE` | `/:id` | Delete a patient (blocked if lab requests exist) |

### Lab Requests (`/api/v1/requests`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a new lab request (idempotent) |
| `GET` | `/` | List lab requests with filtering, sorting, and pagination |
| `GET` | `/:id` | Get a specific lab request |
| `PUT` | `/:id` | Update lab request fields |
| `DELETE` | `/:id` | Delete lab request and related results (transactional) |

### Lab Results (`/api/v1/results`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a new lab result (idempotent) |
| `GET` | `/` | List lab results with filtering, sorting, and pagination |
| `GET` | `/:id` | Get a specific lab result with request context |
| `PUT` | `/:id` | Update lab result fields |
| `DELETE` | `/:id` | Delete a lab result |

### Query and Analytics (`/api/v1/query`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/summary` | Facility summary statistics |
| `GET` | `/requests` | Advanced lab request queries with date ranges |
| `GET` | `/results` | Advanced lab result queries with date ranges |
| `GET` | `/abnormal` | Abnormal results (H, L, A, R flags) |
| `GET` | `/ocm` | Query by OCL concept mappings (JSONB) |
| `GET` | `/trends` | Trends over time (group by day/week/month) |
| `GET` | `/patient-history` | Complete patient lab history |
| `GET` | `/facility-comparison` | Compare multiple facilities |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 11.3.0
- **PostgreSQL** with the `openldr_external` database initialized
- **Docker** and **Docker Compose** (for containerized deployment)

## Configuration

### Environment Variables

The `.env` file is assembled at build time by merging three environment files from the `environments/` directory:

1. `environments/.env.base` -- Shared settings (compose project name, container limits, TLS config)
2. `environments/.env.openldr-external-database` -- Service-specific settings
3. `environments/.env.openldr-postgres` -- Database connection settings

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `production` | `development` or `production` |
| `EXTERNAL_DATABASE_PORT` | `3009` | Port the Express server listens on |
| `EXTERNAL_DATABASE_HOSTNAME` | `openldr-external-database` | Service hostname |
| `POSTGRES_DB_EXTERNAL` | `openldr_external` | External database name |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_HOSTNAME` | `openldr-postgres` | Database host (auto-resolved in containers) |
| `INCLUDE_TEST_DATA` | `true` | Whether to include test data (set to `false` in production) |
| `COMPOSE_PROJECT_NAME` | `openldr` | Docker Compose project name |
| `MEMORY_LIMIT` | `512M` | Container memory limit |

### Database Connection Pool

The connection pool (`src/lib/db.ts`) is configured with:

- **Max connections:** 20
- **Idle timeout:** 30 seconds
- **Connection timeout:** 2 seconds
- In development mode, the host defaults to `localhost`; in production it uses the `POSTGRES_HOSTNAME` environment variable.

## Setup and Deployment

### Local Development

```bash
# From the monorepo root
npm install

# Start the external database service in development mode
cd apps/openldr-external-database
npm run dev
```

The `dev` script runs the server with `tsx watch` for hot-reloading on file changes. In development mode, HTTP request logging uses Morgan's `dev` format.

### Production

```bash
npm run start
```

### Monorepo Commands (from root)

```bash
# Start all services in development mode
npm run dev

# Build all services
npm run build

# Initialize the entire OpenLDR platform
npm run init
```

## Docker Support

### Build and Run

```bash
# Build the Docker image
npm run docker:build

# Start the container
npm run docker:start

# Stop the container
npm run docker:stop

# Full reset (remove images, volumes, orphans)
npm run docker:reset
```

### Dockerfile

The Dockerfile uses a multi-stage Alpine build:

1. **builder** -- Installs Turbo globally, copies the full monorepo, and runs `turbo prune` to isolate the `@openldr/external-database` workspace.
2. **installer** -- Installs dependencies with `npm ci`, copies pruned workspace, and runs `turbo run build`.
3. **runner** -- Minimal runtime image that runs `npm start`.

Base image: `node:24-alpine`.

### Docker Compose

The service is defined in `docker-compose.yml`:

- **Image:** `openldr-external-database:latest`
- **Network:** `openldr-network` (bridge)
- **Restart policy:** `unless-stopped`
- **Volumes:** Mounts Docker socket (`/var/run/docker.sock`)
- **Port:** `3009` (commented out by default; traffic routes through the gateway)

The `docker-compose.ts` wrapper provides compatibility with both Docker Compose V1 (`docker-compose`) and V2 (`docker compose`), with automatic retry logic (up to 3 attempts).

## Integration with Other OpenLDR Services

This service is part of the OpenLDR v2 monorepo and integrates with:

| Service | Relationship |
|---|---|
| **openldr-postgres** | Shared PostgreSQL instance hosting both `openldr` and `openldr_external` databases |
| **openldr-gateway** | API gateway that routes external traffic to this service (port `8090`/`443`) |
| **openldr-data-processing** | Ingests and transforms data from various LIS sources into the external database |
| **openldr-entity-services** | Manages entity-level operations across both databases |
| **openldr-minio** | Object storage for file uploads and import batch artifacts |
| **openldr-kafka** | Event streaming for data pipeline coordination |
| **openldr-ai** | AI/ML services that query the external database for analytics |
| **openldr-studio** / **openldr-web** | Frontend applications that consume this API |
| **openldr-opensearch** | Search indexing of lab data |
| **@repo/openldr-core** | Shared library providing the logger (`pino`) and common utilities |

## Backup and Maintenance

### Database Backup

Back up the external database using standard PostgreSQL tools:

```bash
# Full dump of the external database
pg_dump -h localhost -p 5432 -U postgres -d openldr_external -F c -f openldr_external_backup.dump

# Restore from backup
pg_restore -h localhost -p 5432 -U postgres -d openldr_external -c openldr_external_backup.dump
```

For containerized environments:

```bash
# Backup from the running PostgreSQL container
docker exec openldr-postgres pg_dump -U postgres -d openldr_external -F c > openldr_external_backup.dump

# Restore
docker exec -i openldr-postgres pg_restore -U postgres -d openldr_external -c < openldr_external_backup.dump
```

### Monitoring

- **Health endpoint:** `GET /health` returns uptime, status, and timestamp.
- **Database health check:** The `database.service.ts` module provides a `healthCheck()` function that tests connectivity with a `SELECT NOW()` query.
- **Connection pool events:** The pool emits `connect` and `error` events logged to the console. An idle client error triggers a process exit to allow container restart.

### Maintenance Tasks

- **Connection pool tuning:** Adjust `max`, `idleTimeoutMillis`, and `connectionTimeoutMillis` in `src/lib/db.ts` based on load.
- **Index maintenance:** Run `REINDEX` and `VACUUM ANALYZE` periodically on high-write tables (`lab_requests`, `lab_results`, `isolates`, `susceptibility_tests`).
- **Log rotation:** The `LOG_FILE_KEPT_NUMBER` environment variable controls how many log files are retained (default: 5).
- **Schema migrations:** Managed through SQL files in `apps/openldr-internal-database/migrations/`. The external database schema is in `02-openldr_external.sql`.

## License

Apache License 2.0
