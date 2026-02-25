# openldr-ext-patients

Patient statistics dashboard extension for OpenLDR.

Queries `openldr_external.patients` and renders:
- KPI cards: total, male, female, other/unknown
- Age group distribution bar chart
- Patient status breakdown
- Registration trend sparkline (last 12 months)

## Requirements

- OpenLDR Extension Runtime
- `data.patients` permission approved

## Development

```bash
npm install
npm run build     # one-shot build → dist/index.html
npm run dev       # watch mode
npm run pack      # produces dist/extension.zip for upload
```

## Bundle structure

```
extension.zip
├── manifest.json
└── index.html
```

## openldr.data API used

```ts
openldr.data.query('external', 'patients', {
  page:  1,
  limit: 500,
  sort:  { field: 'created_at', direction: 'desc' }
})
// → { data: Patient[], total: number, page: number, limit: number }
```

## Contributing

Issues and PRs welcome. See [OpenLDR Extension SDK docs](https://github.com/openldr) for the full API reference.
