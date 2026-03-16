# Archives API (Dynamic CRUD)

Base path: `/api/v1/archives`

Provides dynamic, schema-driven CRUD operations against the internal PostgreSQL database. Table names, columns, and primary keys are resolved at runtime via `information_schema`. Record creation and updates are validated against form schemas fetched from the forms service.

Special handling exists for the `plugins`, `users`, and `projects` tables:
- **plugins**: Files are uploaded to MinIO; mapper plugins trigger OCL terminology generation
- **users**: Creation and updates are mirrored to Keycloak
- **projects**: Bucket creation and Kafka notification setup in MinIO

## Endpoints

### List All Tables

```
GET /api/v1/archives/tables
```

**Response (200):**

```json
{
  "status": "successful",
  "data": ["dataFeeds", "facilities", "plugins", "projects", "useCases", "users"]
}
```

---

### Get Table Columns

```
GET /api/v1/archives/table/:name
```

**Response (200):**

```json
{
  "status": "successful",
  "data": [
    {
      "Name": "pluginId",
      "Type": "uuid",
      "Nullable": false,
      "Constraint": null,
      "column_default": null,
      "PrimaryKey": true
    },
    {
      "Name": "pluginName",
      "Type": "character varying",
      "Nullable": false,
      "Constraint": 255,
      "column_default": null,
      "PrimaryKey": false
    }
  ]
}
```

---

### Query Table Data

```
POST /api/v1/archives/data/:name
```

**Request Body:**

```json
{
  "where": { "pluginType": "schema" },
  "order": [["pluginName", "ASC"]],
  "limit": 50,
  "offset": 0
}
```

**Response (200):**

```json
{
  "status": "successful",
  "data": {
    "count": 3,
    "rows": [
      { "pluginId": "uuid-...", "pluginName": "Schema A", "pluginType": "schema" }
    ]
  }
}
```

---

### Create Record

```
POST /api/v1/archives/table/:version/:name/:type
```

- `:version` -- form schema version (e.g., `v1`)
- `:name` -- table name (e.g., `plugins`, `users`, `projects`)
- `:type` -- form type

The request body is validated against the form schema. UUID primary keys are auto-generated.

**Response (200):**

```json
{
  "status": "successful",
  "data": { "...created record..." },
  "primaryKeys": { "pluginId": "new-uuid-..." },
  "cols": [ "...column definitions..." ]
}
```

**Validation failure (200 with status "Failed"):**

```json
{
  "status": "Failed",
  "data": {
    "valid": false,
    "errors": [{ "property": "pluginName", "message": "is required" }]
  }
}
```

---

### Update Record

```
PUT /api/v1/archives/table/:version/:name/:type
```

The request body must include the primary key field. The body is validated against the form schema (update variant).

---

### Delete Record(s)

```
DELETE /api/v1/archives/table/:version/:name/:type
```

**Request Body:** A single primary key value (string) or an array of primary key values.

```json
["uuid-1", "uuid-2"]
```

**Response (200):**

```json
{
  "status": "successful",
  "data": 2,
  "keys": ["uuid-1", "uuid-2"]
}
```

For `plugins`, MinIO objects are cleaned up. For `users`, Keycloak accounts are deleted. For `projects`, associated use cases, data feeds, and MinIO buckets are cascade-deleted.
