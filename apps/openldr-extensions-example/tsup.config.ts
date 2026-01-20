import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["iife"], // Use IIFE format instead of ESM
  globalName: "Extension", // Global variable name
  platform: "browser",
  target: "es2020",
  minify: true,
  sourcemap: false,
  clean: true,
  noExternal: [/.*/],
  external: ["@openldr/extensions", "react", "react-dom"],
  outExtension() {
    return {
      js: ".js", // This will produce index.js instead of index.global.js
    };
  },
  footer: {
    js: `
// Export for the loader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Extension;
}
    `.trim(),
  },
});
