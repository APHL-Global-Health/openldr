# Query Engine API

Base path: `/api/v1/query/engine`

The Query Engine provides a controlled data access layer for extensions. All requests require JWT authentication and an `X-Extension-Id` header. The engine enforces per-extension permission checks based on the user's approved permissions for each installed extension.

## Authentication

All endpoints require:
- `Authorization: Bearer <jwt>` header
- `X-Extension-Id: <extension-id>` header

## Query Modes

Controlled by the `QUERY_MODE` environment variable:

| Mode | Behavior |
|------|----------|
| `direct` (default) | Queries the `openldr_external` PostgreSQL database directly |
| `proxy` | Forwards requests to the live OpenLDR API at `OPENLDR_API_URL` |

## Permission Model

Extensions must be installed by the user. The user's `approved_permissions` for the extension are checked against:

| Permission | Grants Access To |
|------------|-----------------|
| `data.query` | Broad query access to any table |
| `data.patients` | `external.patients` table |
| `data.labRequests` | `external.lab_requests` table |
| `data.labResults` | `external.lab_results` table |

## Endpoints

### Execute Query

```
POST /api/v1/query/engine
```

**Request Body:**

```json
{
  "schema": "external",
  "table": "lab_results",
  "params": {
    "filters": {
      "organism_code": { "eq": "ECOLI" },
      "specimen_date": { "gte": "2025-01-01", "lte": "2025-06-30" }
    },
    "page": 1,
    "limit": 100,
    "sort": {
      "field": "specimen_date",
      "direction": "desc"
    }
  }
}
```

**Filter Operators:**

| Operator | Description |
|----------|-------------|
| `eq` | Equal to |
| `ne` | Not equal to |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `like` | SQL LIKE pattern |
| `in` | Array of values (IN clause) |

Scalar values (string, number, boolean, null) are also accepted as shorthand for `eq`.

**Validation:**
- `schema` must be `"internal"` or `"external"`
- `table` must be lowercase with underscores only (`^[a-z_]+$`), max 64 chars
- `page` must be >= 1
- `limit` must be 1-500 (default: 100)

**Response (200):**

```json
{
  "rows": [ { "id": "...", "organism_code": "ECOLI", "..." : "..." } ],
  "total": 250,
  "page": 1,
  "limit": 100
}
```

**Error (403 - Extension not installed):**

```json
{
  "error": "Extension not installed by this user",
  "code": "NOT_INSTALLED",
  "status": 403
}
```

**Error (403 - Permission denied):**

```json
{
  "error": "Permission denied: requires 'data.labResults' for external.lab_results",
  "code": "PERMISSION_DENIED",
  "required": "data.labResults",
  "approved": ["data.patients"],
  "status": 403
}
```

---

### Get Storage Value

```
POST /api/v1/query/engine/storage/get
```

Retrieves a key-value setting from the user's extension installation.

**Request Body:**

```json
{ "key": "preferredView" }
```

**Response (200):**

```json
{ "value": "table" }
```

---

### Set Storage Value

```
POST /api/v1/query/engine/storage/set
```

**Request Body:**

```json
{ "key": "preferredView", "value": "chart" }
```

**Response (200):**

```json
{ "ok": true }
```

---

### Delete Storage Value

```
POST /api/v1/query/engine/storage/delete
```

**Request Body:**

```json
{ "key": "preferredView" }
```

**Response (200):**

```json
{ "ok": true }
```
