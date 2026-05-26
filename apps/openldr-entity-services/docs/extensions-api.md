# Extensions API

Base path: `/api/v1/extensions`

Manages the extension registry -- publishing, discovery, installation, and payload delivery. Extensions are either `worker` (run in a Web Worker) or `iframe` (run in a sandboxed iframe) and are stored in MinIO.

## Authentication

| Endpoint | Auth Required |
|----------|---------------|
| `GET /` | API Key |
| `GET /:id` | API Key |
| `GET /:id/code` | API Key |
| `GET /:id/permissions` | API Key |
| `POST /` | Bearer JWT + Admin role |
| `GET /user` | Bearer JWT |
| `POST /user/:id` | Bearer JWT |
| `DELETE /user/:id` | Bearer JWT |
| `PATCH /user/:id` | Bearer JWT |

## Rate Limits

- Registry listing (`GET /`, `GET /:id`, `GET /:id/permissions`): **60 req/min**
- Code download (`GET /:id/code`): **30 req/min**

## Endpoints

### List All Extensions

```
GET /api/v1/extensions
```

**Response (200):**

```json
{
  "extensions": [
    {
      "id": "amr-dashboard",
      "name": "AMR Dashboard",
      "version": "1.2.0",
      "description": "Interactive antimicrobial resistance dashboard",
      "kind": "iframe",
      "slot": "main",
      "activationEvents": ["onStartup"],
      "contributes": { "commands": [], "views": [] },
      "author": "OpenLDR Team",
      "icon": "bar-chart",
      "integrity": "sha256-abc...",
      "publishedAt": "2026-03-01T00:00:00.000Z",
      "permissions": ["data.query"],
      "codeUrl": "https://example.com/entity-services/api/v1/extensions/amr-dashboard/code"
    }
  ],
  "total": 1,
  "apiVersion": "2.0.0"
}
```

---

### Get Extension Manifest

```
GET /api/v1/extensions/:id
```

Returns a single extension manifest (same shape as entries in the list above).

---

### Get Extension Code

```
GET /api/v1/extensions/:id/code
```

Returns the extension payload (JS or HTML) wrapped in a JSON envelope. The client must verify the integrity hash before executing the payload.

**Response (200):**

```json
{
  "id": "amr-dashboard",
  "kind": "iframe",
  "payload": "<html>...</html>",
  "integrity": "sha256-abc...",
  "cacheUntil": 1710590400000
}
```

**Response Headers:**
- `X-Integrity`: `sha256-abc...`
- `Cache-Control`: `public, max-age=300, immutable`

---

### Get Extension Permissions

```
GET /api/v1/extensions/:id/permissions
```

**Response (200):**

```json
{
  "id": "amr-dashboard",
  "name": "AMR Dashboard",
  "permissions": ["data.query", "ui.notifications"]
}
```

---

### Publish Extension (Admin)

```
POST /api/v1/extensions
```

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bundle` | File (ZIP) | Yes | Extension ZIP bundle |

The ZIP must contain:
- `manifest.json` -- validated against a Zod schema (id, name, version, description, kind, author, icon, etc.)
- `index.js` (for `kind: "worker"`) or `index.html` (for `kind: "iframe"`)

**manifest.json schema:**

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Does something useful",
  "kind": "worker",
  "author": "Your Name",
  "icon": "zap",
  "permissions": ["data.query"],
  "activationEvents": ["onStartup"],
  "contributes": {
    "commands": [{ "id": "run", "title": "Run Analysis" }],
    "views": []
  }
}
```

**Response (201):**

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

---

### List User's Installed Extensions

```
GET /api/v1/extensions/user
```

**Response (200):**

```json
{
  "installs": [
    {
      "extensionId": "amr-dashboard",
      "installedAt": "2026-03-10T12:00:00.000Z",
      "approvedPermissions": ["data.query"],
      "settings": { "theme": "dark" },
      "extension": { "...manifest..." }
    }
  ],
  "total": 1
}
```

---

### Install Extension

```
POST /api/v1/extensions/user/:id
```

**Request Body:**

```json
{
  "approvedPermissions": ["data.query", "ui.notifications"],
  "settings": {}
}
```

**Response (201):**

```json
{
  "extensionId": "amr-dashboard",
  "approvedPermissions": ["data.query", "ui.notifications"],
  "settings": {},
  "installedAt": "2026-03-16T10:00:00.000Z"
}
```

---

### Uninstall Extension

```
DELETE /api/v1/extensions/user/:id
```

**Response (200):**

```json
{
  "extensionId": "amr-dashboard",
  "uninstalledAt": "2026-03-16T10:05:00.000Z"
}
```

---

### Update Extension Settings

```
PATCH /api/v1/extensions/user/:id
```

**Request Body:**

```json
{
  "settings": { "theme": "light", "autoRefresh": true }
}
```

**Response (200):**

```json
{
  "extensionId": "amr-dashboard",
  "settings": { "theme": "light", "autoRefresh": true }
}
```
