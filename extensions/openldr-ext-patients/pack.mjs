// pack.mjs — creates the distributable extension.zip
// Usage: node pack.mjs
// Output: dist/extension.zip

import AdmZip from 'adm-zip'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const distHtml = resolve('dist/index.html')
const manifest = resolve('manifest.json')

if (!existsSync(distHtml)) {
  console.error('Error: dist/index.html not found — run `npm run build` first')
  process.exit(1)
}

if (!existsSync(manifest)) {
  console.error('Error: manifest.json not found')
  process.exit(1)
}

// Validate manifest
const m = JSON.parse(readFileSync(manifest, 'utf8'))
console.log(`Packing: ${m.name} v${m.version} (${m.kind})`)

const zip = new AdmZip()
zip.addFile('manifest.json', readFileSync(manifest))
zip.addFile('index.html',    readFileSync(distHtml))

// Include README if present
const readme = resolve('README.md')
if (existsSync(readme)) zip.addFile('README.md', readFileSync(readme))

const outPath = resolve('dist/extension.zip')
zip.writeZip(outPath)

const size = (readFileSync(outPath).length / 1024).toFixed(1)
console.log(`✓ dist/extension.zip (${size} KB)`)
console.log(`  Upload at: Settings → Publish Extension`)
