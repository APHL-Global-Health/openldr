import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const ENV = loadEnv(mode, process.cwd(), "");
  const isDev = mode === "development";

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Only use these plugins in production
      !isDev && viteCompression(),
      // isDev &&
      visualizer({
        open: false, // auto-opens in browser after build
        filename: "stats.html",
        gzipSize: true,
      }),
    ],
    assetsInclude: ["**/*.wasm"],

    define: {
      "process.env": {},
      __dirname: "import.meta.dirname",
      __filename: "import.meta.filename",
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    css: {
      postcss: path.resolve(__dirname, "postcss.config.js"),
      // Don't minify in dev mode
      minify: !isDev,
    },

    base: ENV.VITE_BASE_URL,
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      watch: {
        ignored: ["**/node_modules/**", "**/dist/**"],
      },
      // Add these for better dev performance
      hmr: true,
      fs: {
        strict: false,
      },
    },

    // Optimize dependencies
    optimizeDeps: {
      include: ["react", "react-dom", "recharts", "@sqlite.org/sqlite-wasm"],
      exclude: [],
    },

    build: {
      outDir: "dist",
      target: "esnext",
      emptyOutDir: true,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 500,
      // Better tree shaking
      minify: "esbuild",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router"],
            "vendor-animation": ["framer-motion", "motion-dom"],
            "vendor-sqlite": ["@sqlite.org/sqlite-wasm"],
            "vendor-forms": ["zod"],
            "vendor-i18n": [
              "i18next",
              "i18next-http-backend",
              "i18next-browser-languagedetector",
              "react-i18next",
            ],
            "vendor-ui": [
              "@radix-ui/react-select",
              "@radix-ui/react-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-dropdown-menu",
              "sonner",
            ],
            "vendor-data": [
              "axios",
              "@tanstack/query-core",
              "@tanstack/react-query",
              "cross-fetch",
            ],
            // NEW — add these:
            "vendor-dates": ["date-fns", "@date-fns/tz"],
            "vendor-jszip": ["jszip"],
            "vendor-json-view": ["@uiw/react-json-view"],
            "vendor-utils": ["tailwind-merge", "clsx", "immer", "papaparse"],
          },
        },
      },
    },
  };
});
