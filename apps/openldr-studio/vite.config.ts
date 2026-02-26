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
      !isDev &&
        visualizer({
          open: false,
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
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "recharts",
        "@sqlite.org/sqlite-wasm",
        "@tanstack/react-query",
        "@tanstack/react-table",
        "framer-motion",
        "lucide-react",
        "zustand",
        "immer",
        "keycloak-js",
        "date-fns",
        "clsx",
        "tailwind-merge",
        "zod",
      ],
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
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-animation": ["framer-motion", "motion-dom"],
            "vendor-sqlite": ["@sqlite.org/sqlite-wasm"],
            "vendor-forms": ["zod", "react-hook-form", "@hookform/resolvers"],
            "vendor-i18n": [
              "i18next",
              "i18next-http-backend",
              "i18next-browser-languagedetector",
              "react-i18next",
            ],
            "vendor-ui": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-aspect-ratio",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
              "radix-ui",
              "sonner",
              "cmdk",
              "vaul",
              "class-variance-authority",
            ],
            "vendor-data": [
              "axios",
              "@tanstack/query-core",
              "@tanstack/react-query",
            ],
            "vendor-table": ["@tanstack/react-table"],
            "vendor-charts": ["recharts"],
            "vendor-d3": ["d3"],
            "vendor-pdf": ["pdfjs-dist", "react-pdf"],
"vendor-keycloak": ["keycloak-js"],
            "vendor-dates": ["date-fns", "@date-fns/tz", "react-day-picker"],
            "vendor-jszip": ["jszip"],
            "vendor-json-view": ["@uiw/react-json-view"],
            "vendor-utils": [
              "tailwind-merge",
              "clsx",
              "immer",
              "papaparse",
              "zustand",
              "use-debounce",
            ],
          },
        },
      },
    },
  };
});
