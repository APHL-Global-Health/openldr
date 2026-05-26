# Concepts API (Coding Systems & Terminology)

Base path: `/api/v1/concepts`

Manages coding systems, concepts, and concept mappings. This is the local terminology management layer -- coding systems define vocabularies (e.g., LOINC, SNOMED, WHONET), concepts are individual terms within those systems, and mappings define relationships between concepts across systems.

## Coding Systems

### List Coding Systems

```
GET /api/v1/concepts/systems
```

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `system_type` | string | Filter by system type |
| `is_active` | boolean | Filter by active status |
| `include_stats` | boolean | Include concept counts |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "system_code": "LOINC",
      "system_name": "LOINC",
      "system_type": "laboratory",
      "is_active": true
    }
  ]
}
```

---

### Get Coding System by ID

```
GET /api/v1/concepts/systems/:id
```

---

### Get Coding System by Code

```
GET /api/v1/concepts/systems/code/:code
```

---

### Get Coding System Statistics

```
GET /api/v1/concepts/systems/:id/stats
```

---

### Create Coding System

```
POST /api/v1/concepts/systems
```

**Request Body:**

```json
{
  "system_code": "WHONET",
  "system_name": "WHONET Organism Codes",
  "system_type": "microbiology",
  "description": "WHONET organism identification codes"
}
```

**Response (201):**

```json
{ "success": true, "data": { "id": "new-uuid-...", "system_code": "WHONET", "..." : "..." } }
```

**Response (409 - Duplicate):**

```json
{ "success": false, "error": "A coding system with this code already exists" }
```

---

### Update Coding System

```
PUT /api/v1/concepts/systems/:id
```

---

### Delete Coding System

```
DELETE /api/v1/concepts/systems/:id?hard=true
```

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `hard` | boolean | If `true`, permanently delete; otherwise soft-delete |

## Concepts

### List Concepts by System

```
GET /api/v1/concepts/concepts?system_id=<uuid>
```

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `system_id` | UUID | **Required.** Coding system ID |
| `search` | string | Filter by name/code |
| `concept_class` | string | Filter by concept class |
| `is_active` | boolean | Filter by active status |
| `page` | integer | Page number |
| `limit` | integer | Results per page |

---

### Search Concepts (Full-text)

```
GET /api/v1/concepts/concepts/search?q=escherichia
```

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `q` | string | **Required.** Search query |
| `system_id` | UUID | Limit to a specific system |
| `limit` | integer | Max results |

---

### Get Concept Classes

```
GET /api/v1/concepts/concepts/classes/:systemId
```

Returns the distinct concept classes within a coding system.

---

### Get Concept by ID

```
GET /api/v1/concepts/concepts/:id
```

---

### Get Concept Mappings

```
GET /api/v1/concepts/concepts/:id/mappings
```

Returns both outgoing (`from`) and incoming (`to`) mappings for a concept.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "from": [
      { "id": "map-uuid", "from_concept_id": "concept-a", "to_concept_id": "concept-b", "map_type": "SAME_AS" }
    ],
    "to": [
      { "id": "map-uuid", "from_concept_id": "concept-c", "to_concept_id": "concept-a", "map_type": "NARROWER_THAN" }
    ]
  }
}
```

---

### Create Concept

```
POST /api/v1/concepts/concepts
```

**Request Body:**

```json
{
  "system_id": "uuid-...",
  "concept_code": "ECOLI",
  "display_name": "Escherichia coli",
  "concept_class": "Organism"
}
```

---

### Update Concept

```
PUT /api/v1/concepts/concepts/:id
```

---

### Delete Concept

```
DELETE /api/v1/concepts/concepts/:id?hard=true
```

## Mappings

### Create Mapping

```
POST /api/v1/concepts/mappings
```

**Request Body:**

```json
{
  "from_concept_id": "uuid-a",
  "to_concept_id": "uuid-b",
  "map_type": "SAME_AS"
}
```

---

### Update Mapping

```
PUT /api/v1/concepts/mappings/:id
```

---

### Delete Mapping

```
DELETE /api/v1/concepts/mappings/:id
```
