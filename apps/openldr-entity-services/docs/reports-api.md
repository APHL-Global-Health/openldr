# Reports API

Base path: `/api/v1/reports`

Provides laboratory and antimicrobial resistance (AMR) reporting endpoints. Data is queried from the `openldr_external` PostgreSQL database which contains patients, lab requests, isolates, and susceptibility tests. Reports follow WHO GLASS methodology where applicable.

## Common Query Parameters

All report endpoints accept these filters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `facility_id` | UUID | (all) | Filter by facility |
| `date_from` | ISO date | `2025-01-01` | Start of date range |
| `date_to` | ISO date | `2025-06-30` | End of date range |
| `guideline` | string | (all) | Filter by AST guideline (e.g., CLSI, EUCAST) |
| `min_isolates` | integer | `30` | Minimum isolates per organism-antibiotic cell (WHO recommends >= 30) |

## Endpoints

### Antibiogram

```
GET /api/v1/reports/antibiogram
```

Returns organism-antibiotic resistance rates suitable for cumulative antibiogram generation.

**Example:**

```bash
curl "http://localhost:3002/api/v1/reports/antibiogram?date_from=2025-01-01&date_to=2025-06-30&min_isolates=30"
```

**Response (200):**

```json
{
  "metadata": {
    "facility": "All Facilities",
    "date_range": "2025-01-01 - 2025-06-30",
    "guideline": "All guidelines",
    "generated_at": "2026-03-16"
  },
  "data": [
    {
      "organism_code": "ECOLI",
      "organism_name": "Escherichia coli",
      "antibiotic_code": "CTX",
      "antibiotic_name": "Cefotaxime",
      "total_tested": 250,
      "resistant": 45,
      "intermediate": 5,
      "susceptible": 200,
      "resistance_pct": 18.0
    }
  ]
}
```

---

### Priority Pathogens

```
GET /api/v1/reports/priority-pathogens
```

Tracks WHO priority organisms: *A. baumannii*, *K. pneumoniae*, *P. aeruginosa* (Critical); *S. aureus*, *E. coli*, *E. faecium* (High). Returns total isolates, current resistance percentage, and monthly resistance trends.

**Response (200):**

```json
{
  "metadata": {
    "date_range": "2025-01-01 - 2025-06-30",
    "guideline": "All guidelines"
  },
  "pathogens": [
    {
      "who_priority": "CRITICAL",
      "organism_code": "KPNEU",
      "organism_name": "Klebsiella pneumoniae",
      "full_name": "Klebsiella pneumoniae",
      "total_isolates": 120,
      "key_resistance": "3GC-resistant: 35% | Carbapenem-R: 12%",
      "trend": [
        { "month": "Jan", "pct": 10.5 },
        { "month": "Feb", "pct": 12.0 }
      ]
    }
  ]
}
```

---

### AMR Surveillance

```
GET /api/v1/reports/surveillance
```

Comprehensive AMR surveillance including:
- **MRSA**: Monthly trend (overall + by ward type: ICU, general, outpatient) and per-facility rates
- **Carbapenem resistance**: Monthly trend for CRAB, CRPA, CRKP and resistance by mechanism
- **ESBL**: Monthly trend for *E. coli* and *K. pneumoniae*

**Response (200):**

```json
{
  "metadata": { "date_range": "2025-01-01 - 2025-06-30" },
  "mrsa": {
    "trend": [
      { "month": "Jan", "rate": 22.5, "icu": 35.0, "general": 20.0, "outpatient": 15.0 }
    ],
    "by_facility": [
      { "facility": "HOS-001", "rate": 28.5 }
    ]
  },
  "carbapenem": {
    "trend": [
      { "month": "Jan", "abaum_cr": 45.0, "paeru_cr": 18.0, "kpneu_cre": 12.0 }
    ],
    "by_mechanism": [
      { "mechanism": "CRAB", "count": 15, "pct": 45.5 }
    ]
  },
  "esbl": {
    "trend": [
      { "month": "Jan", "ecoli": 35.0, "kpneu": 40.0 }
    ]
  }
}
```

---

### Workload

```
GET /api/v1/reports/workload
```

Laboratory workload analysis: monthly test volumes by section (Chemistry, Haematology, Microbiology, Serology), turnaround time (TAT) percentiles (P50, P90) per section, and specimen type distribution.

**Response (200):**

```json
{
  "metadata": { "date_range": "2025-01-01 - 2025-06-30", "facility": "All Facilities" },
  "monthly_volumes": [
    { "month": "Jan", "CH": 1200, "MB": 450, "HM": 800, "SE": 200, "total": 2650 }
  ],
  "tat_by_section": [
    { "section": "Chemistry", "code": "CH", "p50": 3.2, "p90": 5.8, "target": 6, "unit": "hours" },
    { "section": "Microbiology", "code": "MB", "p50": 24.5, "p90": 48.0, "target": 48, "unit": "hours" }
  ],
  "specimen_type_dist": [
    { "name": "Blood", "value": 35, "color": "#2D9EFF" },
    { "name": "Urine", "value": 25, "color": "#FF4560" }
  ]
}
```

---

### Geographic Distribution

```
GET /api/v1/reports/geographic
```

Per-facility AMR rates (MRSA, CRE, ESBL) with geographic coordinates for map visualization.

**Response (200):**

```json
{
  "metadata": { "date_range": "2025-01-01 - 2025-06-30" },
  "facilities": [
    {
      "facility_code": "HOS-001",
      "facility_name": "Central Hospital",
      "region": "Central",
      "district": "District A",
      "total_isolates": 500,
      "mrsa_rate": 22.5,
      "cre_rate": 8.0,
      "esbl_rate": 35.0,
      "lat": -15.4167,
      "lng": 28.2833
    }
  ]
}
```

---

### Data Quality

```
GET /api/v1/reports/data-quality
```

Import batch success rates and field completeness scoring per facility. Completeness dimensions:
- **Demographics**: patient has date_of_birth and sex
- **Organism**: MB/MI requests have isolates with organism_code
- **AST**: those isolates have susceptibility_test rows
- **Specimen**: request has specimen_code populated

**Response (200):**

```json
{
  "metadata": { "date_range": "2025-01-01 - 2025-06-30" },
  "summary": {
    "total_batches": 150,
    "total_records": 45000,
    "success_rate": 97.5,
    "facilities_active": 12,
    "last_import": "2025-06-28"
  },
  "facilities": [
    {
      "facility": "HOS-001",
      "batches": 25,
      "records": 5000,
      "success_rate": 98.2,
      "completeness_demo": 95.0,
      "completeness_organism": 88.5,
      "completeness_ast": 82.0,
      "completeness_specimen": 99.0
    }
  ],
  "monthly_ingestion": [
    { "month": "Jan", "records": 7500, "success_rate": 97.0 }
  ]
}
```
