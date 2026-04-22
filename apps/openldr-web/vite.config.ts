import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const ENV = loadEnv(mode, process.cwd(), "");
  const isDev = mode === "development";

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Only use these plugins in production
      !isDev && viteCompression(),
      isDev &&
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
        output: {},
      },
    },
  };
});

// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   resolve: {
//     alias: { '@': resolve(__dirname, './src') },
//   },
//   server: { port: 5174 },
// })
