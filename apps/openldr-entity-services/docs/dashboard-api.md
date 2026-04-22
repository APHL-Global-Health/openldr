# Dashboard API

Base path: `/api/v1/dashboard`

Provides aggregated dashboard data for the OpenLDR Studio UI. The full endpoint replaces multiple parallel API calls with a single request.

## Query Parameters

All dashboard endpoints accept the same optional query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDateTime` | ISO 8601 string | Start of today | Start of date range |
| `endDateTime` | ISO 8601 string | Now | End of date range |
| `facilityCode` | string | (all) | Filter by facility code |
| `projectId` | UUID | (all) | Filter by project ID |
| `useCaseId` | UUID | (all) | Filter by use case ID |

## Endpoints

### Full Dashboard

```
GET /api/v1/dashboard
```

Returns the complete aggregated dashboard payload including laboratory and infrastructure data. This is the primary endpoint the frontend should use.

```bash
curl "http://localhost:3002/api/v1/dashboard?startDateTime=2025-01-01T00:00:00Z&endDateTime=2025-06-30T23:59:59Z"
```

---

### Laboratory Dashboard

```
GET /api/v1/dashboard/laboratory
```

Returns laboratory-specific data: KPIs, charts, facility performance, and result summaries. Use when the user navigates to the "Laboratory" tab for a lighter payload.

---

### Infrastructure Dashboard

```
GET /api/v1/dashboard/infrastructure
```

Returns infrastructure data: data pipeline status, service health, storage metrics, and database statistics. Use when the user navigates to the "Infrastructure" tab.
