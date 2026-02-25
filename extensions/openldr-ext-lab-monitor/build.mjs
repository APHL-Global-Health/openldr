// build.mjs — esbuild build script for worker extension
// Workers output raw JS (no HTML template needed).
// Usage: node build.mjs [--watch]

import * as esbuild from 'esbuild'
import { mkdirSync } from 'fs'

const watch = process.argv.includes('--watch')

mkdirSync('dist', { recursive: true })

const options = {
  entryPoints: ['src/index.ts'],
  bundle:      true,
  format:      'iife',
  outfile:     'dist/index.js',
  minify:      !watch,
  sourcemap:   watch ? 'inline' : false,
  target:      ['es2020'],
}

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{
      name: 'log',
      setup(build) {
        build.onEnd(r => {
          if (r.errors.length === 0)
            console.log(`[${new Date().toLocaleTimeString()}] Rebuilt → dist/index.js`)
        })
      }
    }]
  })
  await ctx.watch()
  console.log('Watching…')
} else {
  await esbuild.build(options)
  console.log('Build complete → dist/index.js')
}