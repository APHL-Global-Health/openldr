// build.mjs — esbuild build script
// Bundles src/index.ts → dist/index.html
// The host injects bridge code at the top of the single script block.
// Injection marker: the string  OPENLDR_BRIDGE_INJECT  (no braces, no quotes)
// is replaced by App.tsx with the actual bridge JS before setting srcDoc.

import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle:      true,
  format:      'iife',
  globalName:  '_ext',
  outfile:     'dist/bundle.js',
  minify:      !watch,
  sourcemap:   watch ? 'inline' : false,
  target:      ['es2020'],
}

async function build() {
  mkdirSync('dist', { recursive: true })

  if (watch) {
    const ctx = await esbuild.context({
      ...buildOptions,
      plugins: [{ name: 'html-inject', setup(b) {
        b.onEnd(r => { if (!r.errors.length) { write(); console.log('[' + new Date().toLocaleTimeString() + '] Rebuilt') } })
      }}]
    })
    await ctx.watch()
    console.log('Watching for changes...')
  } else {
    await esbuild.build(buildOptions)
    write()
    console.log('Build complete -> dist/index.html')
  }
}

function write() {
  const bundle = readFileSync(resolve(__dirname, 'dist/bundle.js'), 'utf8')

  // Single script tag. The marker string is replaced by the runtime with
  // bridge JS before the HTML is set as srcDoc. Because it is a bare
  // identifier-like token (no curlies, no template syntax) formatters
  // leave it alone even if they touch this file.
  const marker = 'OPENLDR_BRIDGE_INJECT'

  const parts = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <meta http-equiv="Content-Security-Policy"',
    '    content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\';  connect-src https://127.0.0.1;" />',
    '  <style>',
    '    * { box-sizing: border-box; margin: 0; padding: 0 }',
    '    body { font-family: ui-monospace, monospace; background: #080a0f; color: #e2e8f0; font-size: 12px }',
    '    @keyframes spin { to { transform: rotate(360deg) } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="app" style="padding:12px;height:100vh;overflow-y:auto"></div>',
    '  <script>',
    '  ' + marker,
    '  ' + bundle,
    '  </script>',
    '</body>',
    '</html>',
  ]

  writeFileSync(resolve(__dirname, 'dist/index.html'), parts.join('\n'), 'utf8')
}

build().catch(err => { console.error(err); process.exit(1) })