# openldr-cli — Operator Reference

> CLI for the OpenLDR v2 platform. JSON on stdout, structured errors on stderr, deterministic exit codes. Designed so an LLM agent (e.g. Claude) can operate the entire platform autonomously: every command emits parseable output, every failure carries a stable error code, and every mutation is gated behind an explicit `--confirm` flag.
>
> **Companion doc to point an agent at.** If you give Claude this file and a working clone of the openldr-v2 monorepo, it has everything it needs to inspect services, track payloads, query the databases, and operate the platform.

---

## 1. What this is

`openldr-cli` is the human + AI operator entry point for openldr-v2. It wraps every backing service behind a vendor-neutral command surface and prefers the HTTPS gateway so it works from a workstation outside the docker network:

```
                       ┌────────────────────────┐
                       │       openldr-cli      │
                       └────┬──────────────┬────┘
                            │              │
                  Gateway   │              │   Direct (in-docker only)
                  (HTTPS,   │              │   ports 5432 / 9094 / 9000
                   port 443)│              │
                            ▼              ▼
        ┌──────────────────────────┐  ┌──────────────────────┐
        │  ping  health  services  │  │ db query             │
        │  runs (data-processing)  │  │ tables / schema      │
        │  ingest (data-processing)│  │ queue topics/tail/dlq│
        │  search  (opensearch)    │  │ s3 buckets/ls/cat    │
        │  auth   (keycloak)       │  │                      │
        │  plugins(entity-services)│  │                      │
        │  concepts(entity-services)  │                      │
        └──────────────────────────┘  └──────────────────────┘
```

**Default routing:** every command except the direct-protocol set goes through the HTTPS gateway. The direct-protocol commands — `tables` and `schema` (top-level), `db query` and `db explain` (inside the `db` group), every `queue` subcommand, every `s3` subcommand — require either (a) running the CLI inside the docker network, (b) passing `--internal` so the CLI shells into the right container via `docker exec`, or (c) publishing the relevant ports in `docker-compose.yml`. The gateway proxies HTTP services (data-processing, entity-services, external-database, keycloak, opensearch, kafka-connect) but cannot proxy native protocols (Postgres TCP, Kafka native protocol, MinIO S3 — which breaks under nginx path rewriting due to SigV4).

**Vendor-neutral commands map to backing technology:**

| Command | Today's backing tech | Could swap to |
|---|---|---|
| `queue` | Apache Kafka | Redpanda, NATS JetStream |
| `s3` | MinIO | Garage, Ceph, Wasabi, R2 |
| `search` | OpenSearch | Elasticsearch, Meilisearch, Typesense |
| `auth` | Keycloak | Authentik, Ory, Zitadel |
| `db` | PostgreSQL | (stays — SQL is the contract) |
| `runs` | PostgreSQL tables | (stays) |

---

## 2. Repo layout

```
apps/openldr-cli/
├── package.json            # @openldr/cli, type:module, tsx scripts
├── tsconfig.json           # extends @repo/typescript-config
├── tsconfig.build.json     # emits dist/ for production
├── OPENLDR_CLI.md          # this file
├── README.md               # short pointer
├── bin/openldr             # node shim → dist/index.js (after build)
└── src/
    ├── index.ts            # commander root + subcommand registration
    ├── config.ts           # zod-validated env loader
    ├── errors.ts           # CliError + exit-code map
    ├── output.ts           # ndjson | json | pretty | table serializers
    ├── help.ts             # --help --json schema emitter
    ├── runtime.ts          # loadRuntime(cmd) — config + globals
    ├── types.ts            # shared types
    ├── clients/            # vendor-specific SDK wrappers
    │   ├── postgres.ts
    │   ├── kafka.ts
    │   ├── s3.ts           # @aws-sdk/client-s3 (works with MinIO)
    │   ├── search.ts       # @opensearch-project/opensearch
    │   ├── auth.ts         # Keycloak OAuth + admin REST
    │   └── gateway.ts      # fetch wrapper with retry + token injection
    └── commands/           # USER-FACING vendor-neutral surface
        ├── ping.ts, health.ts, services.ts, config-show.ts,
        ├── tables.ts, schema.ts, errors-cmd.ts,
        ├── runs.ts, queue.ts, db.ts,
        ├── s3.ts, search.ts,
        ├── ingest.ts,
        └── auth.ts, plugins.ts, concepts.ts
```

**Naming rule:** `commands/` use vendor-neutral names. `clients/` may keep vendor-specific names because they're tied to the SDK; swapping the backing tech replaces the client file wholesale while the command surface keeps its public shape.

---

## 3. Setup

```bash
# From the monorepo root:
pnpm install --filter @openldr/cli...

# Daily use (no build needed):
pnpm --filter @openldr/cli dev --help
pnpm --filter @openldr/cli dev ping

# After build:
pnpm --filter @openldr/cli build
node apps/openldr-cli/dist/index.js --help

# (Optional) symlink the bin shim:
chmod +x apps/openldr-cli/bin/openldr
ln -s "$(pwd)/apps/openldr-cli/bin/openldr" ~/.local/bin/openldr
openldr ping
```

When the CLI runs **on the operator's host** (the typical case), it connects to docker-compose services via their externally-mapped ports on `127.0.0.1`. When env vars point at the docker-compose internal hostnames (e.g. `openldr-postgres`), the CLI auto-rewrites them to `HOST_IP` (default `127.0.0.1`).

---

## 4. Command reference

> Every command supports the global flags from §5. Where a command mutates state it accepts at least one of `--dry-run`, `--dry-run-post`, or `--confirm` / `--allow-write`.

### 4.1 Health & introspection (Core)

#### `openldr ping`
Connectivity smoke-test. Probes every backing service in parallel (Postgres + Kafka via TCP; S3/Search/Auth/Gateway via HTTP). Returns one row per service.

```bash
$ openldr ping
{"service":"postgres","endpoint":"127.0.0.1:5432","ok":true,"elapsed_ms":4}
{"service":"kafka","endpoint":"127.0.0.1:9094","ok":true,"elapsed_ms":3}
{"service":"s3","endpoint":"http://127.0.0.1:9000","ok":true,"elapsed_ms":2}
{"service":"search","endpoint":"http://127.0.0.1:9200","ok":true,"elapsed_ms":1}
{"service":"auth","endpoint":"https://127.0.0.1:443/keycloak","ok":true,"elapsed_ms":21}
{"service":"gateway","endpoint":"https://127.0.0.1:443","ok":true,"elapsed_ms":1}
```
Exit code: `0` if all green; `1` if any service is down.

#### `openldr health [--service <name>]`
Hits each service's `/health` HTTP endpoint via the gateway. Distinguishes "TCP socket open" (ping) from "service is actually serving traffic" (health).

```bash
$ openldr health
{"service":"data-processing","url":"https://127.0.0.1:443/data-processing/health","elapsed_ms":12,"ok":true,"status":200,"body":{"status":"ok",…}}

$ openldr health --service entity-services
```

#### `openldr services`
Lists every service the CLI knows about, with its resolved endpoint. Use this when configuring a remote operator.

```bash
$ openldr services --output table
name              role                                        endpoint
----------------  ------------------------------------------  ----------------------------------
postgres          primary RDBMS (openldr + openldr_external)  127.0.0.1:5432
kafka             message queue (queue commands)              127.0.0.1:9094
minio             S3-compatible object storage (s3 cmds)      http://127.0.0.1:9000
…
```

#### `openldr config show [--reveal-secrets]`
Dumps loaded config with passwords/keys redacted to `***` by default.

```bash
$ openldr config show
{
  "postgres": { "host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "***", "database": "openldr", … },
  "auth": { "clientSecret": "***", … }
}
```

#### `openldr tables [--db <name>]`
Lists tables across both Postgres databases with approximate row counts (from `pg_class.reltuples`).

```bash
$ openldr tables --db openldr --output table
db        schema  name                       approx_rows
--------  ------  -------------------------  -----------
openldr   public  messageProcessingRuns      0
openldr   public  messageProcessingEvents    0
openldr   public  plugins                    16
```

#### `openldr schema <table> [--db <name>]`
Per-column metadata (type, nullable, default, max length). Default DB: `openldr`.

```bash
$ openldr schema messageProcessingRuns --db openldr
{"name":"id","type":"uuid","nullable":"NO","default_value":"gen_random_uuid()","max_length":null}
{"name":"messageId","type":"uuid","nullable":"NO","default_value":null,"max_length":null}
{"name":"currentStage","type":"character varying","nullable":"NO","default_value":null,"max_length":50}
```

#### `openldr errors`
Prints the full error-code/exit-code table. Always in sync with `src/errors.ts`.

```bash
$ openldr errors
{"code":"USAGE","exit":2,"description":"Invalid arguments or usage"}
{"code":"CONFIG_MISSING","exit":3,"description":"Required env var or flag not configured"}
{"code":"DB_CONNECT_FAILED","exit":4,"description":"Could not connect to PostgreSQL"}
{"code":"NOT_FOUND","exit":6,"description":"Requested object, row, or resource does not exist"}
{"code":"AUTH_FAILED","exit":7,"description":"Authentication failed (token fetch, credentials, expired session)"}
{"code":"WRITE_NOT_CONFIRMED","exit":12,"description":"Mutating command attempted without --confirm / --allow-write"}
```

#### `openldr --help --json [<subcommand>...]`
Emits the entire command tree as a `JsonCommand` schema (name, description, options, arguments, subcommands). This is how a downstream tool (or LLM) self-discovers the CLI surface at runtime without parsing help text.

```bash
$ openldr --help --json | jq '.subcommands | map(.name)'
["ping","health","services","config","tables","schema","errors","runs","queue","db","s3","search","ingest","auth","plugins","concepts","help"]

$ openldr runs --help --json | jq '.subcommands[] | {name, description}'
{"name":"list","description":"List recent runs (most recent first)"}
{"name":"get","description":"Single run by id OR messageId, with all joined events"}
{"name":"follow","description":"Poll a run until it reaches a terminal status (SUCCESS, FAILED)"}
```

### 4.2 Payload tracking — `runs` (Core)

| Subcommand | Purpose |
|---|---|
| `runs list [--status SUCCESS\|FAILED\|...] [--stage <s>] [--feed <id>] [--since <iso>] [--limit N]` | Query `messageProcessingRuns` |
| `runs get <runId>` | Single run + joined `messageProcessingEvents` |
| `runs follow <runId> [--interval Ns] [--timeout Ns]` | Poll until terminal status |
| `runs events <runId> [--stage <s>]` | Stream events for a run |
| `runs replay <runId> --confirm` | Re-enqueue via `POST /data-processing/api/v1/runs/{id}/retry` (write-gated) |

```bash
# Recent failures
$ openldr runs list --status FAILED --limit 5

# Watch a payload progress
$ openldr runs follow 7f3a9c12-…  --interval 1 --timeout 60
{"currentStage":"validation","currentStatus":"IN_PROGRESS",…}
{"currentStage":"mapping","currentStatus":"IN_PROGRESS",…}
{"currentStage":"storage","currentStatus":"SUCCESS",…}

# Full picture of one run (run + every event)
$ openldr runs get 7f3a9c12-… --output json | jq .

# Replay a failed run (write-gated)
$ openldr runs replay 7f3a9c12-…           # exit 12 — WRITE_NOT_CONFIRMED
$ openldr runs replay 7f3a9c12-… --confirm # actually retry
```

### 4.3 Queue & DLQ inspection — `queue` (Core, Kafka)

| Subcommand | Purpose |
|---|---|
| `queue topics` | List topics with partition + replica counts |
| `queue offsets [--group <g>]` | Per-consumer-group offset table |
| `queue tail <topic> [--from-beginning] [--limit N] [--group <g>]` | Stream messages |
| `queue dlq [--topic <t>] [--limit N] [--summary]` | Dead-letter inspection |
| `queue publish <topic> --file <p> [--key <k>] --confirm` | Hand-publish (write-gated) |

```bash
# What topics exist
$ openldr queue topics --output table
topic                          partitions  replicas
-----------------------------  ----------  --------
raw-inbound                    3           1
validated-inbound              3           1
mapped-inbound                 3           1
processed-inbound              3           1
raw-inbound-dead-letter        3           1

# Inspect a dead letter
$ openldr queue dlq --summary
{"topic":"raw-inbound-dead-letter","partitions":3,"message_count":2}

$ openldr queue dlq --topic raw-inbound-dead-letter --limit 1
{"topic":"raw-inbound-dead-letter","partition":0,"offset":"5","key":"7f3a9c12-…","value":{"error":"schema_mismatch","payload_hash":"…"}}

# Tail latest from processed-inbound
$ openldr queue tail processed-inbound --limit 3
```

### 4.4 Database query — `db` (Core)

| Subcommand | Purpose |
|---|---|
| `db query <sql> [--db openldr\|openldr_external] [--allow-write] [--limit N]` | Read-only by default; non-SELECT statements rejected unless `--allow-write` |
| `db explain <sql> [--db <name>]` | `EXPLAIN ANALYZE` wrapper |

```bash
$ openldr db query "SELECT COUNT(*) FROM \"messageProcessingRuns\""
{"count":"123"}

$ openldr db query "DELETE FROM users"
{"error":{"code":"WRITE_NOT_CONFIRMED","message":"Non-SELECT statement rejected. Re-run with --allow-write to permit writes.",…}}
# exit 12

$ openldr db query "SELECT system_code, COUNT(*) FROM coding_systems cs JOIN concepts c ON c.system_id=cs.id GROUP BY 1" --db openldr_external
```

### 4.5 Object storage — `s3` (Storage, MinIO)

| Subcommand | Purpose |
|---|---|
| `s3 buckets` | List buckets |
| `s3 ls <bucket> [--prefix <p>] [--limit N]` | List objects |
| `s3 cat <bucket>/<key>` | Stream to stdout (text-safe) |
| `s3 stat <bucket>/<key>` | Metadata (size, content-type, last-modified) |
| `s3 download <bucket>/<key> --out <path>` | Binary-safe download |
| `s3 upload <bucket> --file <path> [--key <k>] [--content-type <ct>] --confirm` | Write-gated |

```bash
$ openldr s3 buckets --output table
$ openldr s3 ls raw-inbound --limit 5
$ openldr s3 cat raw-inbound/7f3a9c12-… | jq .
$ openldr s3 stat processed-inbound/7f3a9c12-…/payload.json
```

### 4.6 Search — `search` (Storage, OpenSearch)

| Subcommand | Purpose |
|---|---|
| `search indices` | List indices with doc count + size |
| `search query <index> [-q <lucene>] [-b <json>] [--size N]` | Search |
| `search get <index>/<id>` | Single document |
| `search mapping <index>` | Index mapping |

```bash
$ openldr search indices
$ openldr search query lab-requests -q 'panel_code:HEM' --size 3
$ openldr search query lab-requests -b '{"query":{"match":{"panel_code":"HEM"}}}'
$ openldr search get lab-requests/abc-123
$ openldr search mapping lab-requests
```

### 4.7 Ingest — `ingest`

| Subcommand | Purpose |
|---|---|
| `ingest validate <file>` | Local payload validation (JSON parse + size + top-level keys). No network. |
| `ingest submit <file> --feed <id> [--dry-run] [--dry-run-post] [--track] [--track-timeout Ns] [--track-interval Ns]` | POST to `/data-processing/api/v1/processor/process-feed`. `--track` polls `messageProcessingRuns` until terminal status. |
| `ingest batch <dir> --feed <id> [--concurrency N] [--resume-from i] --confirm` | Bulk submit. Emits NDJSON journal to stdout, summary to stderr. Without `--confirm` runs in dry-run-post mode. |
| `ingest stream --feed <id> [--concurrency N] [--track] [--track-timeout Ns] [--track-interval Ns] [--dry-run-post] [--fail-fast]` | **Reads NDJSON payloads from stdin**, one per line. POSTs each through the gateway with a worker pool. Emits per-payload status to stdout, summary to stderr. Exit 1 if any line failed. Designed as the consumer side of `cdr-toolchain export-batch --emit-payloads | openldr ingest stream …`. |

The `ingest stream` path is served by a path-scoped relaxed nginx zone (`ingest-bulk`, 500 r/s + 200 burst — see `apps/openldr-gateway/nginx.conf.template`) so a single bulk client can sustain ~10× more throughput than the default `/data-processing/*` 50 r/s ceiling.

```bash
# Local dry-run
printf '%s\n' '{"hello":"a"}' '{"hello":"b"}' \
  | openldr ingest stream --feed <feedId> --dry-run-post

# Pipe from cdr-toolchain (Phase-2 export-batch --emit-payloads)
cdr-toolchain export-batch --where "labno BETWEEN '2024-01-01' AND '2024-06-30'" --emit-payloads \
  | openldr ingest stream --feed <feedId> --concurrency 16 --track \
  > submitted.ndjson 2> summary.json
```

```bash
# Validate without contacting the platform
$ openldr ingest validate ./sample-payload.json
{"file":"./sample-payload.json","valid":true,"size_bytes":4221,"top_level_keys":["patient","specimen","results"]}

# Preview the HTTP request before sending
$ openldr ingest submit ./sample-payload.json --feed <feedId> --dry-run-post
{"method":"POST","url":"https://127.0.0.1:443/data-processing/api/v1/processor/process-feed","headers":{"Content-Type":"application/json","Authorization":"Bearer ***","X-DataFeed-Id":"<feedId>"},"body":{…}}

# Real submit + watch to terminal status
$ openldr ingest submit ./sample-payload.json --feed <feedId> --track --track-timeout 60
{"file":"./sample-payload.json","feed":"<feedId>","status":202,"messageId":"7f3a9c12-…"}
{"currentStage":"validation","currentStatus":"IN_PROGRESS"}
{"currentStage":"storage","currentStatus":"SUCCESS"}

# Bulk
$ openldr ingest batch ./payloads/ --feed <feedId> --concurrency 4 --confirm > journal.ndjson 2> summary.json
```

### 4.8 Identity / auth — `auth` (Keycloak)

| Subcommand | Purpose |
|---|---|
| `auth token [--grant client_credentials\|admin]` | Print an access token |
| `auth users list [--search <q>] [--limit N]` | Realm users |
| `auth users get <userId\|username>` | User detail (resolves UUIDs OR usernames) |
| `auth users create --username <u> [--email <e>] [--password <p>] [--first-name <n>] [--last-name <n>] --confirm` | Write-gated |
| `auth users grant <userId> --role <r> --confirm` | Grant realm role (write-gated) |
| `auth roles list` | Realm roles |

```bash
$ openldr auth token | jq -r .access_token

$ openldr auth users list --search admin --output table

$ openldr auth users create --username new-operator --email op@example.org --password 'temp-Pa55!' --confirm
{"created":"new-operator"}
```

### 4.9 Plugins — `plugins`

Manages the `plugins` table in the `openldr` database.

| Subcommand | Purpose |
|---|---|
| `plugins list [--type validation\|mapping\|storage\|outpost] [--status active\|draft\|inactive\|deprecated] [--limit N]` | List |
| `plugins get <id>` | Detail |
| `plugins enable <id> --confirm` | Set status=active |
| `plugins disable <id> --confirm` | Set status=inactive |

```bash
$ openldr plugins list --type mapping --status active
$ openldr plugins get 4f1c…
$ openldr plugins disable 4f1c… --confirm
```

### 4.10 Concepts / terminology — `concepts`

Queries the `openldr_external` database's coding_systems / concepts / concept_mappings tables. The `idx_concepts_display` GIN trigram index makes fuzzy search fast.

| Subcommand | Purpose |
|---|---|
| `concepts search <term> [--system <code>] [--class <c>] [--limit N]` | Fuzzy match on display_name |
| `concepts get <system>/<code>` | Single concept |
| `concepts mappings <fromCode> [--to-system <s>] [--limit N]` | Cross-walks |

```bash
$ openldr concepts search "hemoglobin" --limit 3
{"id":"…","system":"LOINC","concept_code":"718-7","display_name":"Hemoglobin [Mass/volume] in Blood","concept_class":"test","datatype":"numeric","sim":0.82}

$ openldr concepts get LOINC/718-7
$ openldr concepts mappings 718-7 --to-system WHONET_ORG
```

---

## 5. Global flags

| Flag | Default | Purpose |
|---|---|---|
| `--output <fmt>` | `ndjson` | `ndjson` \| `json` \| `pretty` \| `table` |
| `--env-file <path>` | `./.env` | Load extra env from a dotenv file |
| `--log-level <lvl>` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `--no-color` | off | Suppress ANSI |
| `--quiet` | off | Silence stderr metadata (does not affect errors) |
| `--gateway-url <url>` | env `GATEWAY_URL` or `https://127.0.0.1:443` | Override HTTP base |
| `--insecure-tls` | off | Disable TLS verify (for local self-signed certs) |
| `--fields <list>` | unset | Comma-separated field projection |
| `-v, --version` | | Print version |
| `-h, --help [--json]` | | Help text; `--json` adds machine-readable schema |

**Write-gating flags** — every mutating command accepts at least one:
- `--dry-run` — local-only, no network
- `--dry-run-post` — print the prepared HTTP request without sending
- `--confirm` / `--allow-write` — actually execute the mutation

---

## 6. Configuration reference

The CLI loads env vars in this precedence (highest wins):

1. CLI flags (`--gateway-url`, `--env-file`, …)
2. Process env
3. `./.env` in the working directory
4. The file passed via `--env-file`

In addition, you can run `pnpm --filter @openldr/cli copy:env` to merge all `environments/.env.*` files into `apps/openldr-cli/.env`.

Key env vars the CLI reads (defaults for local docker-compose shown):

| Domain | Var | Default |
|---|---|---|
| Postgres | `POSTGRES_HOSTNAME` | `127.0.0.1` (auto-rewrites `openldr-postgres` → host IP) |
|  | `POSTGRES_PORT` | `5432` |
|  | `POSTGRES_USER` / `POSTGRES_PASSWORD` | `postgres` / `postgres` |
|  | `POSTGRES_DB` / `POSTGRES_DB_EXTERNAL` | `openldr` / `openldr_external` |
| Kafka | `KAFKA_HOSTNAME` | `127.0.0.1` |
|  | `KAFKA_EXTERNAL_PORT` | `9094` |
| MinIO | `MINIO_HOSTNAME` / `MINIO_API_PORT` | `127.0.0.1` / `9000` |
|  | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `minioadmin` / `minioadmin` |
|  | `MINIO_REGION` | `us-east-1` |
| OpenSearch | `OPENSEARCH_HOSTNAME` / `OPENSEARCH_PORT` | `127.0.0.1` / `9200` |
| Keycloak | `KEYCLOAK_PUBLIC_URL` | `https://127.0.0.1:443/keycloak` |
|  | `KEYCLOAK_REALM` | `openldr-realm` |
|  | `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET` | `openldr-client` / (required for auth) |
|  | `KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD` | required for `auth users/roles` admin endpoints |
| Gateway | `GATEWAY_URL` | `https://${HOST_IP:-127.0.0.1}:${GATEWAY_HTTPS_PORT:-443}` |
| CLI | `OPENLDR_OUTPUT` | `ndjson` |
|  | `OPENLDR_INSECURE_TLS` | `false` |

When a `*_HOSTNAME` env var points at a docker-compose internal name (matches `openldr-*`), the CLI rewrites it to `HOST_IP` (or `127.0.0.1`) so the same env file works inside containers AND on the host.

---

## 7. Exit codes

| Code | Symbol | Meaning |
|---:|---|---|
| 0 | — | Success |
| 1 | UNKNOWN | Generic failure |
| 2 | USAGE / MISSING_FLAG / UNKNOWN_TARGET / NOT_SUPPORTED | Argument problem |
| 3 | CONFIG_MISSING / CONFIG_INVALID / ENV_FILE_UNREADABLE | Configuration error |
| 4 | DB_CONNECT_FAILED / DB_QUERY_FAILED | Postgres error |
| 5 | QUEUE_CONNECT_FAILED / QUEUE_OP_FAILED | Kafka error |
| 6 | NOT_FOUND | Object/row/topic/bucket/index not found |
| 7 | AUTH_FAILED | Keycloak token or admin credentials failed |
| 8 | GATEWAY_5XX | Upstream service returned 5xx |
| 9 | GATEWAY_4XX | Upstream service returned 4xx (excluding 429) |
| 10 | TIMEOUT | `runs follow` / `ingest --track` / gateway timeout |
| 11 | QUARANTINED | Data-quality gate tripped |
| 12 | WRITE_NOT_CONFIRMED | Mutation attempted without `--confirm` / `--allow-write` |
| 13 | S3_OP_FAILED | Object storage error |
| 14 | SEARCH_OP_FAILED | Search backend error |

Run `openldr errors` to get the same table machine-readable. Stable across versions — safe to script against.

Every error also appears on **stderr** as JSON:

```json
{"error":{"code":"WRITE_NOT_CONFIRMED","message":"…","details":{"sql":"DELETE FROM users"}}}
```

---

## 8. Verification

Assumes `pnpm docker:start` has the stack running. Each command should produce the shape shown below; specific row contents will differ.

```bash
# Self-introspection (no platform needed)
pnpm --filter @openldr/cli dev errors                       # ≥ 14 rows
pnpm --filter @openldr/cli dev --help --json | jq '.subcommands | length'   # 17

# Connectivity
pnpm --filter @openldr/cli dev ping
pnpm --filter @openldr/cli dev health
pnpm --filter @openldr/cli dev services --output table
pnpm --filter @openldr/cli dev config show

# Payload tracking
pnpm --filter @openldr/cli dev runs list --limit 5
pnpm --filter @openldr/cli dev tables --db openldr

# Queue
pnpm --filter @openldr/cli dev queue topics
pnpm --filter @openldr/cli dev queue tail processed-inbound --limit 1
pnpm --filter @openldr/cli dev queue dlq --summary

# DB
pnpm --filter @openldr/cli dev db query "SELECT 1 AS ok"
pnpm --filter @openldr/cli dev db query "DELETE FROM users"      # exit 12

# Storage
pnpm --filter @openldr/cli dev s3 buckets
pnpm --filter @openldr/cli dev search indices

# Ingest dry-run
echo '{"hello":"world"}' > /tmp/x.json
pnpm --filter @openldr/cli dev ingest validate /tmp/x.json

# Auth
pnpm --filter @openldr/cli dev auth token

# Concepts (requires WHONET ref data already loaded by openldr-init)
pnpm --filter @openldr/cli dev concepts search "hemoglobin" --limit 3
```

---

## 9. Known limitations & gotchas

### Connectivity (read first if a command fails with ECONNREFUSED)

The default `docker-compose` only exposes the HTTPS gateway (port 443), the AI service (8100), and the MCP server (6060) to the host. Everything else is internal-only on the `openldr-network`. The CLI handles this by routing every HTTP-capable command through the gateway:

| Command | Route | Works from host without port exposure? |
|---|---|---|
| `ping`, `health`, `services`, `config show` | gateway / local | ✅ |
| `runs *` | `/data-processing/api/v1/runs/*` | ✅ |
| `ingest *` | `/data-processing/api/v1/processor/*` | ✅ |
| `auth *` | `/keycloak/*` | ✅ |
| `plugins *` | `/data-processing` + `/entity-services/api/v1/plugin/*` | ✅ |
| `concepts *` | `/entity-services/api/v1/concepts/*` | ✅ |
| `search *` | `/opensearch/*` | ✅ |
| `tables` *(top-level)* | direct Postgres TCP 5432 | ❌ — use `--internal` (psql via `docker exec`) or expose port |
| `schema <table>` *(top-level)* | direct Postgres TCP 5432 | ❌ — use `--internal` or expose port |
| `db query` and `db explain` | direct Postgres TCP 5432 | ❌ — use `--internal` or expose port |
| `queue topics` / `offsets` / `tail` / `dlq` / `publish` | direct Kafka TCP 9094 | ❌ — use `--internal` (kafka-* tools via `docker exec`) or expose port |
| `s3 buckets` / `ls` / `cat` / `stat` / `download` / `upload` | direct MinIO TCP 9000 | ❌ — use `--internal` (mc via `docker exec`) or expose port (SigV4 breaks under gateway path rewriting) |

> **Note on the command tree.** `tables` and `schema` are **top-level commands**, not subcommands of `db`. The `db` group contains only `query` and `explain`. `openldr db tables` will fail with `unknown command 'tables'` — use `openldr tables --internal` instead. See §4 for the full tree.

**Three ways to use the direct-protocol commands:**

1. **Use `--internal` (recommended).** The CLI shells into the running container via `docker exec` and uses the tool that's already installed there: `psql` for `tables`, `schema`, `db query`, `db explain`; `kafka-topics`/`kafka-console-consumer`/`kafka-console-producer` for `queue`; `mc` for `s3`. No port exposure required.

   ```bash
   openldr db query "SELECT COUNT(*) FROM \"messageProcessingRuns\"" --internal
   openldr tables --db openldr_external --internal
   openldr schema messageProcessingRuns --internal
   openldr queue topics --internal
   openldr queue tail processed-inbound --limit 3 --internal
   openldr queue dlq --summary --internal
   openldr s3 buckets --internal
   openldr s3 ls raw-inbound --limit 5 --internal
   openldr s3 cat raw-inbound/<uuid>.json --internal | jq .
   openldr s3 download mapped-inbound/<key> --out ./payload.json --internal
   ```

   Requirements: `docker` on the operator's PATH and the relevant containers running. Container names come from `POSTGRES_HOSTNAME` / `KAFKA_HOSTNAME` / `MINIO_HOSTNAME` in the env (defaults: `openldr-postgres`, `openldr-kafka1`, `openldr-minio`).

2. **Publish the ports in `docker/docker-compose.yml`.** Add a `ports:` block to each affected service. Convenient for repeated use but exposes the services to anyone on your machine.

3. **Use the alternative HTTP-API command instead.** `db query` → `runs list` / `concepts search`. `s3 ls` → MinIO console at `/minio-console/`. `queue tail` → Conduktor console at `/kafka-console/` or the Kafka Connect REST API at `/kafka-connect/`.

### Other gotchas

- **Self-signed TLS:** the local `openldr-nginx` gateway uses a self-signed cert. Either run with `--insecure-tls`, set `OPENLDR_INSECURE_TLS=true`, or trust the cert in your host keychain.
- **Kafka log retention is 1 hour** (`KAFKA_LOG_RETENTION_HOURS=1`) in dev. `queue tail --from-beginning` may show fewer messages than expected on long-running stacks.
- **MinIO TTL auto-expiry:** `raw-inbound` objects live 7 days, `validated-inbound` / `mapped-inbound` 3 days, `processed-inbound` 90 days, `sources` indefinitely. `s3 cat` on an aged object returns `NOT_FOUND` (exit 6).
- **`runs follow` polls the data-processing API.** A run is only visible after the validation stage writes its first event. For very-early failures the CLI shows `NOT_FOUND` until the row materialises.
- **`auth users create` requires admin credentials** (`KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD`). Client-credentials tokens don't have realm-admin scopes.
- **`db query` row cap:** results are sliced to `--limit` (default 200) before serialization. Use `--limit 10000` for larger pulls, but consider NDJSON to stream.
- **No `--track` for ingest batch yet.** Tracking is per-payload via `runs follow` after the bulk submit completes.
- **`ping --internal`** additionally probes raw Postgres + Kafka TCP — useful when verifying port exposure but expected to fail otherwise.

---

## 10. Code map

| Concern | File |
|---|---|
| Commander root + subcommand registration | `src/index.ts` |
| Env loading + validation (Zod) | `src/config.ts` |
| Output serializers (NDJSON/JSON/pretty/table) | `src/output.ts` |
| Error class + exit-code table | `src/errors.ts` |
| `--help --json` schema emitter | `src/help.ts` |
| Per-command runtime/context | `src/runtime.ts` |
| Postgres pool (both DBs) | `src/clients/postgres.ts` |
| Kafka admin/consumer/producer | `src/clients/kafka.ts` |
| S3 (MinIO) | `src/clients/s3.ts` |
| OpenSearch | `src/clients/search.ts` |
| Keycloak tokens (client_credentials + admin) | `src/clients/auth.ts` |
| Generic gateway HTTP wrapper | `src/clients/gateway.ts` |
| Health/intro commands | `src/commands/{ping,health,services,config-show,tables,schema,errors-cmd}.ts` |
| Core | `src/commands/{runs,queue,db}.ts` |
| Storage | `src/commands/{s3,search}.ts` |
| Ingest | `src/commands/ingest.ts` |
| Admin | `src/commands/{auth,plugins,concepts}.ts` |

---

## 11. Adding a new subcommand

1. Create `src/commands/<topic>.ts` exporting `register<Topic>Command(program: Command): void`.
2. Inside that function, `const topic = program.command("<topic>").description("…")` then attach subcommands with `.command("<verb> [<arg>]").action(async (...) => { … })`.
3. In the action handler, `const rt = loadRuntime(cmd)` to get config + output options.
4. Emit rows with `emitRow(...)` / `emitArray(...)` from `src/output.ts`.
5. Throw `new CliError("<CODE>", "<msg>", { ...details })` on failure — `formatError` in `src/errors.ts` handles the JSON + exit code.
6. If the command mutates state, gate with `--confirm` and emit `WRITE_NOT_CONFIRMED` otherwise.
7. Register in `src/index.ts`: `import { registerXxxCommand } from "./commands/xxx.js"; registerXxxCommand(program);`

**Style:**
- File names in `commands/` are vendor-neutral (e.g. `queue.ts` even though it's Kafka today).
- Help text in command descriptions must be honest about the backing tech in parens — e.g. *"Inspect the message queue (currently backed by Kafka)"*.

---

## 12. Roadmap

Explicitly **not** in v1:

- **AI/MCP integration** — the MCP server (`apps/openldr-mcp-server`) already wraps these for natural-language workflows; the CLI is the deterministic side door.
- **Schema migration runner** — lives in `openldr-setup`.
- **Real-time TUI / `openldr watch`** — would need a richer renderer than commander provides.
- **Multi-realm / multi-tenant** — single realm assumed.
- **Backup / restore** — out of scope; use vendor tools (pg_dump, mc mirror).
- **Plugin upload to MinIO** — `plugins upload` registered as a stub; needs the entity-services upload endpoint wired before it's useful.
- **Run replay with `--from-stage`** — current `runs replay` re-enqueues from the same stage Kafka left it on.
- **`ingest batch --track`** — bulk track requires deferred follower logic.

---

## License

Apache-2.0. See `LICENSE` at the repo root.
