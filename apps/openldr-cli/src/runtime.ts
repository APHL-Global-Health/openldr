import type { Command } from "commander";
import { loadConfig, type LoadedConfig, type ConfigOverrides } from "./config.js";
import { isValidFormat, type OutputFormat, type OutputOptions } from "./output.js";
import type { RuntimeGlobals } from "./types.js";

export interface Runtime {
  globals: RuntimeGlobals;
  config: LoadedConfig;
  output: OutputOptions;
}

export function getGlobals(cmd: Command): RuntimeGlobals {
  const opts = cmd.optsWithGlobals();
  const fmtIn = typeof opts.output === "string" ? opts.output : "ndjson";
  const fmt: OutputFormat = isValidFormat(fmtIn) ? fmtIn : "ndjson";
  const color = opts.color !== false;
  const quiet = opts.quiet === true;
  const logLevelIn = typeof opts.logLevel === "string" ? opts.logLevel : "info";
  const logLevel = (["error", "warn", "info", "debug"] as const).includes(
    logLevelIn as never,
  )
    ? (logLevelIn as RuntimeGlobals["logLevel"])
    : "info";

  return { outputFormat: fmt, color, quiet, logLevel };
}

export function loadRuntime(cmd: Command, extras: ConfigOverrides = {}): Runtime {
  const globals = getGlobals(cmd);
  const opts = cmd.optsWithGlobals();
  const config = loadConfig({
    envFile: typeof opts.envFile === "string" ? opts.envFile : undefined,
    outputFormat: globals.outputFormat,
    gatewayUrl: typeof opts.gatewayUrl === "string" ? opts.gatewayUrl : undefined,
    insecureTls: opts.insecureTls === true ? true : undefined,
    ...extras,
  });

  const output: OutputOptions = {
    format: globals.outputFormat,
    color: globals.color,
    fields:
      typeof opts.fields === "string"
        ? opts.fields.split(",").map((s: string) => s.trim()).filter(Boolean)
        : undefined,
  };

  return { globals, config, output };
}

export function emitMetaIfNotQuiet(rt: Runtime, meta: Record<string, unknown>): void {
  if (rt.globals.quiet) return;
  process.stderr.write(JSON.stringify(meta) + "\n");
}
