# Plugins API

Base path: `/api/v1/plugin`

Manages plugins -- reusable processing modules stored in MinIO. Supports two categories: standard plugins (uploaded as files) and mapper plugins (auto-generated from Open Concept Lab terminology sources).

## Endpoints

### List All Plugins

```
GET /api/v1/plugin/plugins
```

**Response (200):**

```json
[
  {
    "pluginId": "uuid-...",
    "pluginType": "schema",
    "pluginName": "WHONET Schema",
    "pluginVersion": "1.0.0",
    "pluginMinioObjectPath": "uuid/schema_1.0.0.js",
    "securityLevel": "low",
    "config": null,
    "notes": "Standard WHONET format schema"
  }
]
```

---

### List Plugins by Type

```
GET /api/v1/plugin/get-plugins?pluginType=schema
```

---

### Get Plugin with Content

```
GET /api/v1/plugin/get-plugin/:id
```

Returns the plugin metadata plus the file content from MinIO.

**Response (200):**

```json
{
  "pluginId": "uuid-...",
  "pluginType": "schema",
  "pluginName": "WHONET Schema",
  "pluginVersion": "1.0.0",
  "pluginFile": "// plugin source code..."
}
```

---

### Create Plugin

```
POST /api/v1/plugin/create-plugin
```

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pluginData` | File | Yes | Plugin source file |
| `pluginType` | string | Yes | Plugin type (e.g., `schema`, `recipient`, `mapper`) |
| `pluginName` | string | Yes | Display name |
| `pluginVersion` | string | Yes | Semantic version |
| `securityLevel` | string | Yes | Security level (e.g., `low`) |
| `config` | string | No | JSON configuration |
| `notes` | string | No | Description/notes |

---

### Create Mapper Plugin (from OCL)

```
POST /api/v1/plugin/create-mapper-plugin
```

Generates a terminology mapping file from OCL and stores it as a plugin.

**Request Body:**

```json
{
  "pluginName": "LOINC Mapper",
  "pluginVersion": "1.0.0",
  "securityLevel": "low",
  "notes": "Auto-generated from OCL",
  "config": {
    "oclUrl": "https://api.openconceptlab.org",
    "orgId": "WHO",
    "sourceId": "LOINC",
    "auth": { "type": "none" }
  }
}
```

---

### Update Plugin

```
PUT /api/v1/plugin/update-plugin/:id
```

**Content-Type:** `multipart/form-data` (same fields as create; file is optional for metadata-only updates)

---

### Update Mapper Plugin

```
PUT /api/v1/plugin/update-mapper-plugin/:id
```

If config values (OCL source, org, auth) change, the version must be incremented and the terminology mapping file is regenerated.

---

### Delete Plugin

```
DELETE /api/v1/plugin/delete-plugin/:id
```

Removes both the database record and the MinIO object.

---

### Regenerate Mapper Plugin

```
POST /api/v1/plugin/regenerate-mapper-plugin/:id
```

Re-fetches concepts/mappings from OCL and overwrites the stored file. Requires a new version number.

**Request Body:**

```json
{
  "pluginVersion": "1.1.0",
  "config": {
    "oclUrl": "https://api.openconceptlab.org",
    "orgId": "WHO",
    "sourceId": "LOINC",
    "auth": { "type": "none" }
  }
}
```
