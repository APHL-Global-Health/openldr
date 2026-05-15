export interface RuntimeGlobals {
  outputFormat: "ndjson" | "json" | "pretty" | "table";
  color: boolean;
  quiet: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
}

export interface CommandRuntime {
  globals: RuntimeGlobals;
  // The config is built lazily by helpers; commands import loadConfig
  // directly when they need it. This keeps tools like `--help --json`
  // fast (no env validation needed for help output).
}
