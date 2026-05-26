# Users API

Base path: `/api/v1/users`

Manages user records in the internal database. User creation and updates are mirrored to Keycloak for identity management.

## Endpoints

### List Users

```
GET /api/v1/users
```

**Query Parameters:** Any key-value pairs are passed as filters to the user service.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "userId": "a1b2c3d4-e5f6-...",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  ]
}
```

---

### Get User by ID

```
GET /api/v1/users/:userId
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "userId": "a1b2c3d4-e5f6-...",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe"
  }
}
```

**Response (404):**

```json
{
  "success": false,
  "error": "User not found"
}
```

---

### Create User

```
POST /api/v1/users
```

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Smith"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "new-uuid-...",
    "email": "newuser@example.com",
    "firstName": "John",
    "lastName": "Smith"
  },
  "message": "User created successfully"
}
```

---

### Update User

```
PUT /api/v1/users/:userId
```

**Request Body:** Partial user object with fields to update.

**Response (200):**

```json
{
  "success": true,
  "data": { "...updated user..." },
  "message": "User updated successfully"
}
```

---

### Delete User

```
DELETE /api/v1/users/:userId
```

**Response (200):**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```
