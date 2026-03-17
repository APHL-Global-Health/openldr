# openldr-ext-disa-migration

## Development

```bash
npm install
npm run build     # vite build → dist/index.html
npm run dev       # vite dev server (preview only, no openldr SDK)
npm run pack      # produces dist/extension.zip for upload
```

## Bundle format

```
extension.zip
├── manifest.json
└── index.html     (Vite bundle inlined)
```

## Contributing

Issues and PRs welcome.
