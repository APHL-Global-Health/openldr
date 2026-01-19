import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  const ENV = loadEnv(mode, process.cwd(), "");
  const isDev = mode === "development";

  return {
    root: ".",
    clearScreen: false,

    plugins: [
      react(),
      tailwindcss(),
      // Only use these plugins in production
      !isDev && visualizer({ open: false }),
      !isDev && viteCompression(),
      nodePolyfills(),
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
      include: ["react", "react-dom", "recharts"],
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
    },
  };
});
