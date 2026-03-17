// pack.mjs — creates dist/extension.zip
import AdmZip from 'adm-zip'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const distHtml = resolve('dist/index.html')
const manifest = resolve('manifest.json')

if (!existsSync(distHtml)) {
  console.error('Error: dist/index.html not found — run `npm run build` first')
  process.exit(1)
}

const m = JSON.parse(readFileSync(manifest, 'utf8'))
console.log(`Packing: ${m.name} v${m.version} (${m.kind})`)

const zip = new AdmZip()
zip.addFile('manifest.json', readFileSync(manifest))
zip.addFile('index.html',    readFileSync(distHtml))

// Include SQL scripts declared in manifest.scripts
const scripts = m.scripts || {}
let scriptCount = 0
for (const [id, def] of Object.entries(scripts)) {
  const scriptPath = resolve('src', def.file)
  if (!existsSync(scriptPath)) {
    console.error(`Error: Script file '${def.file}' (${id}) not found at ${scriptPath}`)
    process.exit(1)
  }
  zip.addFile(def.file, readFileSync(scriptPath))
  scriptCount++
}

if (existsSync('README.md')) zip.addFile('README.md', readFileSync('README.md'))

const outPath = resolve('dist/extension.zip')
zip.writeZip(outPath)
const size = (readFileSync(outPath).length / 1024).toFixed(1)
console.log(`✓ dist/extension.zip (${size} KB)`)
console.log(`  ${scriptCount} SQL scripts included`)
console.log(`  Upload at: Settings → Publish Extension`)
