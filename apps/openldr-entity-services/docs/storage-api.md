# Storage API (MinIO)

Base path: `/api/v1/storage`

Manages file uploads, downloads, and bucket operations against MinIO (S3-compatible object storage). File uploads use `multipart/form-data` via Multer with a 100 MB size limit.

## Endpoints

### Upload File

```
POST /api/v1/storage/upload
```

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The file to upload |
| `bucket` | string | Yes | Target bucket name |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "bucket": "my-bucket",
    "key": "results.csv",
    "path": "my-bucket/results.csv",
    "size": 10240,
    "hash": "sha256-abc123def...",
    "originalName": "results.csv"
  }
}
```

---

### Download File

```
GET /api/v1/storage/download/:bucket/:key
```

Returns the file as a binary download with the original filename.

---

### Delete File

```
DELETE /api/v1/storage/file/:bucket/:key
```

**Response (200):**

```json
{
  "success": true,
  "data": { "deleted": true, "bucket": "my-bucket", "key": "file.csv" }
}
```

---

### Create Bucket

```
POST /api/v1/storage/bucket
```

**Request Body:**

```json
{
  "bucketName": "my-new-bucket"
}
```

Or generate from a lab code:

```json
{
  "labCode": "LAB-001"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": { "bucketName": "my-new-bucket" }
}
```

---

### Delete Bucket

```
DELETE /api/v1/storage/bucket/:bucketName?force=true
```

| Query Param | Type | Description |
|-------------|------|-------------|
| `force` | boolean | If `true`, force-delete even if non-empty |

---

### Get Bucket Stats

```
GET /api/v1/storage/bucket/:bucketName/stats
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "bucketName": "my-bucket",
    "objectCount": 42,
    "totalSize": 1048576
  }
}
```

---

### Check Bucket Exists

```
GET /api/v1/storage/bucket/:bucketName/exists
```

**Response (200):**

```json
{
  "success": true,
  "data": { "bucketName": "my-bucket", "exists": true }
}
```

---

### List All Buckets

```
GET /api/v1/storage/buckets
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "buckets": ["bucket-a", "bucket-b"],
    "count": 2
  }
}
```

---

### Ensure Bucket Exists

```
POST /api/v1/storage/bucket/:bucketName/ensure
```

Creates the bucket if it does not already exist.

**Response (200):**

```json
{
  "success": true,
  "data": { "bucketName": "my-bucket", "ensured": true }
}
```

---

### Validate Bucket Name

```
POST /api/v1/storage/bucket/validate
```

**Request Body:**

```json
{ "bucketName": "my-bucket" }
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "bucketName": "my-bucket",
    "valid": true,
    "rules": {
      "length": "Must be between 3 and 63 characters",
      "start": "Must start with lowercase letter or number",
      "end": "Must end with lowercase letter or number",
      "allowed": "Can contain lowercase letters, numbers, and hyphens"
    }
  }
}
```

---

### Generate Bucket Name

```
POST /api/v1/storage/bucket/generate
```

**Request Body:**

```json
{ "labCode": "LAB-001" }
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "labCode": "LAB-001",
    "bucketName": "lab-001",
    "valid": true
  }
}
```

---

### Calculate File Hash

```
POST /api/v1/storage/file/hash
```

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The file to hash |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "fileName": "data.csv",
    "hash": "sha256-abc123...",
    "size": 2048
  }
}
```
