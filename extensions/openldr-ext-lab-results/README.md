# openldr-ext-lab-results

Lab results browser extension for OpenLDR (built with Vite).

Queries `openldr_external.lab_results` with:
- Status filter (Final / Preliminary / Cancelled)
- Test name text filter
- Sortable columns
- Pagination (50 rows/page)
- CSV export of current page

## Requirements

- OpenLDR Extension Runtime
- `data.labResults` permission approved

## Development

```bash
npm install
npm run build     # vite build → dist/index.html
npm run dev       # vite dev server (preview only, no openldr SDK)
npm run pack      # produces dist/extension.zip for upload
```

## openldr.data API used

```ts
// Fetch with filters + pagination
openldr.data.query('external', 'lab_results', {
  filters: { status: 'final', test_name: 'Glucose' },
  page:    1,
  limit:   50,
  sort:    { field: 'resulted_at', direction: 'desc' }
})
// → { data: LabResult[], total: number, page: number, limit: number }
```

## Bundle format

```
extension.zip
├── manifest.json
└── index.html     (Vite bundle inlined)
```

## Contributing

Issues and PRs welcome.
