// pack.mjs — creates dist/extension.zip
import AdmZip from 'adm-zip'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const distJs  = resolve('dist/index.js')
const manifest = resolve('manifest.json')

if (!existsSync(distJs)) {
  console.error('Error: dist/index.js not found — run `npm run build` first')
  process.exit(1)
}

const m = JSON.parse(readFileSync(manifest, 'utf8'))
console.log(`Packing: ${m.name} v${m.version} (${m.kind})`)

const zip = new AdmZip()
zip.addFile('manifest.json', readFileSync(manifest))
zip.addFile('index.js',      readFileSync(distJs))   // workers use index.js

if (existsSync('README.md')) zip.addFile('README.md', readFileSync('README.md'))

const outPath = resolve('dist/extension.zip')
zip.writeZip(outPath)
const size = (readFileSync(outPath).length / 1024).toFixed(1)
console.log(`✓ dist/extension.zip (${size} KB)`)
console.log(`  Upload at: Publish Extension in the runtime UI`)
