# OpenLDR Internal Database

The centralized PostgreSQL database service for the OpenLDR (Open Laboratory Data Repository) platform. This service provisions and initializes the database infrastructure that underpins the entire OpenLDR ecosystem -- managing internal application state, external laboratory data, authentication, and event streaming metadata.

## Role in the OpenLDR System

OpenLDR is a multi-service platform for ingesting, validating, mapping, and analyzing laboratory data from diverse sources (HL7, FHIR, CSV, WHONET, etc.) with a particular focus on antimicrobial resistance (AMR) surveillance. This database service is the **foundational data layer** that every other service depends on:

- **openldr-entity-services** -- reads and writes internal entities (projects, use cases, facilities, plugins, data feeds)
- **openldr-data-processing** -- tracks message processing pipelines and stores processing events
- **openldr-external-database** -- shares the same PostgreSQL instance; hosts all laboratory results, AMR data, and terminology
- **openldr-keycloak** -- uses a dedicated `keycloak` database for identity and access management
- **openldr-kafka / openldr-opensearch** -- Conduktor Console uses a dedicated `conduktor_console` database
- **openldr-gateway** -- routes traffic; pgAdmin is exposed through the gateway for database management
- **openldr-web / openldr-studio** -- front-end applications that consume data through entity services
- **openldr-ai / openldr-mcp-server** -- AI and MCP services that query laboratory and AMR data

## Tech Stack

| Component       | Technology                        |
|-----------------|-----------------------------------|
| Database Engine | **PostgreSQL 16**                 |
| Admin UI        | **pgAdmin 4** (optional)          |
| Migrations      | Raw SQL executed via `docker-entrypoint-initdb.d` |
| Orchestration   | Docker Compose (V1 and V2 supported) |
| Build Tooling   | TypeScript (tsx), Turborepo       |
| Extensions      | `pgcrypto`, `uuid-ossp`, `pg_trgm` |

## Database Schema Overview

The PostgreSQL instance hosts **four databases**, each created by a numbered migration script:

| Database            | Created By           | Purpose                                          |
|---------------------|----------------------|--------------------------------------------------|
| `openldr`           | `01-openldr.sql`     | Internal application state -- users, projects, plugins, data feeds, notifications, extensions, processing tracking |
| `openldr_external`  | `02-openldr_external.sql` | External laboratory data repository -- terminology, facilities, patients, lab results, AMR/AST data, analytics views |
| `keycloak`          | `03-keycloak.sql`    | Keycloak identity provider storage               |
| `conduktor_console` | `04-conduktor_console.sql` | Conduktor (Kafka management UI) storage      |

Reference data is loaded by two additional migrations:

| Migration | Purpose |
|-----------|---------|
| `97-openldr_external_whonet_reference.sql` | WHONET reference data (organisms, antibiotics, specimens) with AMR-for-R enrichment (~563 antibiotics, organisms, specimen types) |
| `98-openldr_external_amr_for_r_ref.sql` | AMR-for-R package reference data (498 antimicrobials, microorganisms, antivirals, cross-mappings) |

### Internal Database (`openldr`) -- Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `users` | Platform user profiles | -- |
| `projects` | Top-level organizational unit for grouping use cases | -- |
| `useCases` | Specific data collection scenarios within a project | FK to `projects` |
| `facilities` | Healthcare facility registry with geographic hierarchy | -- |
| `plugins` | Plugin registry (validation, mapping, storage, outpost) with MinIO paths | -- |
| `dataFeeds` | Data ingestion pipeline configurations linking plugins to use cases | FK to `useCases`, `plugins` (schema, mapper, recipient) |
| `formSchemas` | JSON Schema definitions for forms and archive entities | FK to `dataFeeds` |
| `notifications` | System notifications with read status and expiry | -- |
| `extensions` | Installable UI extensions (worker or iframe type) | -- |
| `userExtensions` | Per-user extension installations and settings | FK to `extensions` |
| `messageProcessingRuns` | End-to-end tracking of message processing pipelines | FK-like to `projects`, `dataFeeds` |
| `messageProcessingEvents` | Granular event log for each processing stage | FK-like to `messageProcessingRuns` via `messageId` |

### External Database (`openldr_external`) -- Tables

The external database follows a layered architecture:

```
Layer 1: Terminology & Mapping (OCL-inspired)
  coding_systems --> concepts --> concept_mappings

Layer 2: Infrastructure
  facilities (with concept linkage)

Layer 3: Data Provenance
  data_sources --> import_batches --> field_mappings

Layer 4: Core Lab Data
  patients --> lab_requests --> lab_results

Layer 5: AMR Extension
  isolates --> susceptibility_tests
  breakpoints, qc_ranges, dosage, intrinsic_resistance, organism_groups

Layer 6: Triggers (auto-update updated_at)

Layer 7: Analytics Views
  vw_facility_summary, vw_resistance_rates, vw_concept_crosswalk
```

| Table | Layer | Purpose |
|-------|-------|---------|
| `coding_systems` | Terminology | Registry of vocabularies (LOINC, ICD-10, WHONET, SNOMED, ATC, etc.) |
| `concepts` | Terminology | Individual codes within a coding system with multilingual names |
| `concept_mappings` | Terminology | Cross-walks between codes across systems (SAME-AS, NARROWER-THAN, etc.) |
| `facilities` | Infrastructure | Lab/hospital registry with geographic and LIS vendor metadata |
| `data_sources` | Provenance | Registered external systems feeding data (HL7, CSV, WHONET, FHIR) |
| `import_batches` | Provenance | Every ingest run tracked with record counts and error logs |
| `field_mappings` | Provenance | JSON-based rules mapping source fields to OpenLDR columns |
| `patients` | Core Lab | Patient demographics with encrypted IDs for de-identified analytics |
| `lab_requests` | Core Lab | Test-panel orders (maps to HL7 OBR segments) |
| `lab_results` | Core Lab | Individual observations/results (maps to HL7 OBX segments) |
| `isolates` | AMR | Organisms isolated from specimens with resistance markers |
| `susceptibility_tests` | AMR | Antibiotic susceptibility results (S/I/R interpretations) |
| `breakpoints` | AMR | CLSI/EUCAST interpretation criteria per organism+antibiotic |
| `qc_ranges` | AMR | Expected QC ranges for ATCC reference strains |
| `dosage` | AMR | EUCAST standard/high dosage recommendations |
| `intrinsic_resistance` | AMR | Organism+antibiotic intrinsic resistance pairs |
| `organism_groups` | AMR | Organism complex/group memberships for breakpoint matching |

### Entity Relationship Diagram (Simplified)

```
INTERNAL (openldr)
==================

projects --(1:N)--> useCases --(1:N)--> dataFeeds --(N:1)--> plugins
                                             |                  (schema, mapper, recipient)
                                             v
                                        formSchemas

extensions --(M:N via userExtensions)--> users (Keycloak sub)

messageProcessingRuns --(1:N)--> messageProcessingEvents


EXTERNAL (openldr_external)
===========================

coding_systems --(1:N)--> concepts --(M:N via concept_mappings)--> concepts
                               |
                               v
facilities <-- data_sources --> import_batches
    |                               |
    v                               v
patients --> lab_requests --> lab_results --> isolates --> susceptibility_tests
                                                              |
                                            breakpoints <-----+ (org + abx lookup)
                                            qc_ranges
                                            intrinsic_resistance
                                            organism_groups
```

## Prerequisites

- **Docker** (with Docker Compose V1 or V2)
- **Node.js** >= 18
- **npm** 11.3.0+ (monorepo package manager)
- **tsx** (TypeScript execution, installed as a dependency)

## Configuration

### Environment Variables

Environment variables are assembled from multiple base files located in the repository root `environments/` directory. The `copy:env` script merges them:

```
environments/.env.base
environments/.env.openldr-keycloak
environments/.env.openldr-postgres
environments/.env.openldr-pgadmin
environments/.env.openldr-minio
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `openldr` | Primary database name |
| `POSTGRES_USER` | `postgres` | PostgreSQL superuser |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `POSTGRES_PORT` | `5432` | PostgreSQL port (internal) |
| `POSTGRES_HOSTNAME` | `openldr-postgres` | Container hostname on Docker network |
| `PGADMIN_DEFAULT_EMAIL` | `admin@admin.com` | pgAdmin login email |
| `PGADMIN_DEFAULT_PASSWORD` | `postgres` | pgAdmin login password |
| `PGADMIN_CONFIG_SERVER_MODE` | `False` | Run pgAdmin in desktop mode |
| `PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED` | `False` | Skip master password prompt |

> **Note:** The `.env` file is generated automatically and is listed in `.gitignore`. Do not commit it.

### Docker Compose

The `docker-compose.yml` defines two services:

1. **openldr-postgres** -- PostgreSQL 16 with all migration SQL files mounted into `/docker-entrypoint-initdb.d/`
2. **openldr-pgadmin** -- pgAdmin 4 web UI, pre-configured to connect to the PostgreSQL instance, accessible at `/postgres-console`

Both services share the `openldr-network` bridge network and use named volumes (`postgres_data`, `pgadmin_data`) for persistence.

## Setup and Deployment

### Using Turborepo (Recommended)

From the **monorepo root**:

```bash
# Pull images and set up all services
npm run docker:build

# Start all services
npm run docker:start

# Stop all services
npm run docker:stop

# Full reset (removes images, volumes, and orphan containers)
npm run docker:reset
```

### Standalone

From this directory (`apps/openldr-internal-database`):

```bash
# Pull images (generates .env from environment files first)
npm run docker:build

# Start services in detached mode
npm run docker:start

# Stop services
npm run docker:stop

# Full reset -- removes all data, images, and volumes
npm run docker:reset
```

### Verifying the Setup

Once running, PostgreSQL is available on the Docker network at `openldr-postgres:5432`. The pgAdmin UI is available via the gateway at `https://<host>/postgres-console`.

To connect from the host (if ports are uncommented in docker-compose.yml):

```bash
psql -h localhost -p 5432 -U postgres -d openldr
```

## Migration System

Migrations use PostgreSQL's built-in `docker-entrypoint-initdb.d` mechanism:

1. SQL files in the `migrations/` directory are mounted into the container's `/docker-entrypoint-initdb.d/` directory.
2. PostgreSQL executes them **in alphabetical/numerical order** on **first startup only** (when the data volume is empty).
3. The numbered prefix controls execution order:

| Order | File | Action |
|-------|------|--------|
| 01 | `01-openldr.sql` | Creates internal schema (tables, enums, triggers, seed data) |
| 02 | `02-openldr_external.sql` | Creates external lab data schema (8 layers) |
| 03 | `03-keycloak.sql` | Creates the `keycloak` database |
| 04 | `04-conduktor_console.sql` | Creates the `conduktor_console` database |
| 97 | `97-openldr_external_whonet_reference.sql` | Loads WHONET reference data into `openldr_external` |
| 98 | `98-openldr_external_amr_for_r_ref.sql` | Loads AMR-for-R reference data into `openldr_external` |

> **Important:** Migrations only run on a fresh volume. To re-run migrations, you must destroy the data volume first (`npm run docker:reset`).

A commented-out `99-mock-data.sql` entry in `docker-compose.yml` and `.gitignore` indicates support for optional test data that is not committed to version control.

## Docker Support

The `docker-compose.ts` wrapper script provides compatibility with both Docker Compose V1 (`docker-compose`) and V2 (`docker compose`). It retries up to 3 times with a 2-second delay on failure.

### Services

| Service | Image | Ports | Healthcheck |
|---------|-------|-------|-------------|
| `openldr-postgres` | `postgres:16` | `5432` (internal only by default) | `pg_isready -U postgres` every 10s |
| `openldr-pgadmin` | `dpage/pgadmin4:latest` | `80` (internal only by default) | -- |

### Volumes

| Volume | Purpose |
|--------|---------|
| `postgres_data` | Persistent PostgreSQL data directory |
| `pgadmin_data` | pgAdmin configuration and session data |

### Network

All containers connect to the `openldr-network` bridge network, which is shared across all OpenLDR services.

## Integration with Other OpenLDR Services

```
                          openldr-gateway (APISIX)
                                 |
              +------------------+------------------+
              |                  |                  |
         openldr-web      openldr-studio      openldr-ai
              |                  |                  |
              +--------+---------+                  |
                       |                            |
                openldr-entity-services    openldr-mcp-server
                       |                            |
                       +------------+---------------+
                                    |
                          openldr-internal-database
                          [PostgreSQL 16]
                          +----+----+----+----+
                          | openldr | openldr_external |
                          | keycloak | conduktor_console |
                          +----+----+----+----+
                                    |
              +---------------------+---------------------+
              |                     |                     |
        openldr-keycloak   openldr-kafka          openldr-minio
        (auth via keycloak DB) (Conduktor via     (plugin files referenced
                            conduktor_console DB)  by plugins.pluginMinioObjectPath)
```

- **openldr-keycloak** connects to the `keycloak` database for identity management (realms, clients, users)
- **openldr-kafka** ecosystem uses the `conduktor_console` database for Kafka management UI state
- **openldr-entity-services** is the primary consumer of the `openldr` database for CRUD operations
- **openldr-data-processing** writes to `messageProcessingRuns` and `messageProcessingEvents` for pipeline tracking
- **openldr-minio** stores plugin binaries; paths are recorded in the `plugins.pluginMinioObjectPath` column
- **openldr-external-database** may reference the same PostgreSQL instance for the `openldr_external` database containing all lab and AMR data

## Backup and Maintenance

### Database Backup

```bash
# Backup all databases
docker exec openldr-postgres pg_dumpall -U postgres > openldr_full_backup.sql

# Backup a specific database
docker exec openldr-postgres pg_dump -U postgres openldr > openldr_backup.sql
docker exec openldr-postgres pg_dump -U postgres openldr_external > openldr_external_backup.sql

# Backup with compression
docker exec openldr-postgres pg_dump -U postgres -Fc openldr > openldr_backup.dump
```

### Restore

```bash
# Restore from SQL dump
docker exec -i openldr-postgres psql -U postgres < openldr_full_backup.sql

# Restore from compressed dump
docker exec -i openldr-postgres pg_restore -U postgres -d openldr openldr_backup.dump
```

### Maintenance Tasks

```bash
# Run VACUUM ANALYZE on all databases
docker exec openldr-postgres psql -U postgres -c "VACUUM ANALYZE;"

# Check database sizes
docker exec openldr-postgres psql -U postgres -c "\l+"

# Monitor active connections
docker exec openldr-postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

### Volume Management

- Data persists in the `postgres_data` Docker volume across container restarts.
- To completely reset the database (including re-running all migrations): `npm run docker:reset`
- To inspect volume data: `docker volume inspect openldr_postgres_data`

### Production Considerations

- Change all default passwords (`POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`, Keycloak credentials)
- Uncomment and configure port mappings in `docker-compose.yml` only if external access is needed
- Enable SSL/TLS for PostgreSQL connections
- Set up automated backups with `pg_dump` on a cron schedule
- Monitor disk usage on the `postgres_data` volume, especially after large reference data imports
- Consider setting `PGADMIN_CONFIG_SERVER_MODE=True` and requiring a master password in production

## License

Apache License 2.0
