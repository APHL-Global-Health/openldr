import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

function injectPlugin() {
  return {
    name: "openldr-inject",
    apply: "build" as const,
    closeBundle() {
      const distDir = resolve(__dirname, "dist");
      const jsFile = readdirSync(distDir).find((f: string) =>
        f.endsWith(".js"),
      );
      if (!jsFile) throw new Error("No JS bundle found in dist/");

      const bundle = readFileSync(resolve(distDir, jsFile), "utf8");
      const marker = "OPENLDR_BRIDGE_INJECT";

      // Built as an array — Prettier never touches array string elements
      const parts = [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="UTF-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        '  <meta http-equiv="Content-Security-Policy"',
        "    content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';  connect-src https://127.0.0.1;\" />",
        "  <style>",
        "    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }",
        "    :root {",
        "      --bg:#080a0f;--surface:#0d0f16;--border:#1e2232;--subtle:#2d3652;",
        "      --muted:#475569;--text:#94a3b8;--bright:#e2e8f0;--amber:#f59e0b;",
        "      --teal:#2dd4bf;--purple:#a78bfa;--green:#34d399;--red:#f87171;",
        "    }",
        '    body { font-family: ui-monospace,"Cascadia Code","SF Mono",monospace; background:var(--bg); color:var(--text); font-size:12px; height:100vh; display:flex; flex-direction:column; overflow:hidden }',
        "    #app { flex:1; display:flex; flex-direction:column; overflow:hidden }",
        "  </style>",
        "</head>",
        "<body>",
        '  <div id="app"></div>',
        "  <script>",
        "  " + marker,
        "  " + bundle,
        "  </script>",
        "</body>",
        "</html>",
      ];

      const final = parts.join("\n");
      writeFileSync(resolve(distDir, "index.html"), final, "utf8");
      console.log(
        "[openldr-inject] dist/index.html (" +
          (final.length / 1024).toFixed(1) +
          " KB)",
      );
    },
  };
}

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/main.ts"),
      output: { entryFileNames: "bundle.js", format: "iife", name: "_ext" },
    },
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
  },
  plugins: [injectPlugin()],
});
