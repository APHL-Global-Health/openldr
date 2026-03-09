// ─────────────────────────────────────────────────────────────────────────────
// apps/api/src/services/plugin-runner.service.ts
//
// Runs plugin code inside a Node.js VM context so it never touches the Kafka
// pipeline. Each plugin must expose a top-level async function named `run`.
//
// Validation plugin contract:
//   async function run(payload: Record<string, unknown>): Promise<{
//     passed: boolean;
//     checks: Array<{ rule: string; status: 'pass'|'warn'|'fail'; message: string }>;
//     output: Record<string, unknown>;   // enriched payload forwarded to mapping
//   }>
//
// Mapping plugin contract:
//   async function run(payload: Record<string, unknown>): Promise<{
//     output: Record<string, unknown>;   // transformed payload (e.g. FHIR)
//   }>
// ─────────────────────────────────────────────────────────────────────────────

import vm from "node:vm";
import type {
  ValidationStageResult,
  MappingStageResult,
  RunPluginTestResponse,
} from "@/types/plugin.test.types";

const PLUGIN_TIMEOUT_MS = 8_000;

// ── Low-level VM executor ────────────────────────────────────────────────────

async function execPluginCode(
  code: string,
  input: Record<string, unknown>,
): Promise<{ result: unknown; logs: string[] }> {
  const logs: string[] = [];

  const sandbox = {
    payload: structuredClone(input),
    result: undefined as unknown,
    __logs: logs,
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) =>
        logs.push("[warn] " + args.map(String).join(" ")),
      error: (...args: unknown[]) =>
        logs.push("[error] " + args.map(String).join(" ")),
    },
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    Math,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Promise,
    URL,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(sandbox);

  // Wrap the plugin body so it can declare `async function run(...)` then we
  // call it and store the awaited value in `result`.
  const script = new vm.Script(`
    (async () => {
      var module = { exports: {} };
      var exports = module.exports;

      ${code}
      if (typeof run !== 'function') throw new Error('Plugin must export an async function named \\'run\\'');
      result = await run(payload);

      return module.exports;
    })();
  `);

  // `
  //   (function() {
  //     var module = { exports: {} };
  //     var exports = module.exports;
  //     ${pluginSource}
  //     return module.exports;
  //   })();
  // `

  // runInContext returns a Promise (the IIFE), we await it with a race timeout
  const p = script.runInContext(sandbox) as Promise<void>;

  await Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Plugin timed out after ${PLUGIN_TIMEOUT_MS}ms`)),
        PLUGIN_TIMEOUT_MS,
      ),
    ),
  ]);

  return { result: sandbox.result, logs };
}

// ── Stage runners ─────────────────────────────────────────────────────────────

async function runValidation(
  code: string,
  payload: Record<string, unknown>,
): Promise<ValidationStageResult> {
  const start = Date.now();
  const { result, logs } = await execPluginCode(code, payload);

  const r = result as {
    passed: boolean;
    checks: Array<{
      rule: string;
      status: "pass" | "warn" | "fail";
      message: string;
    }>;
    output: Record<string, unknown>;
  };

  if (typeof r?.passed !== "boolean" || !Array.isArray(r?.checks)) {
    throw new Error(
      "Validation plugin returned unexpected shape. Expected { passed, checks, output }",
    );
  }

  return {
    passed: r.passed,
    checks: r.checks,
    output: r.output ?? payload,
    logs,
    durationMs: Date.now() - start,
  };
}

async function runMapping(
  code: string,
  payload: Record<string, unknown>,
): Promise<MappingStageResult> {
  const start = Date.now();
  const { result, logs } = await execPluginCode(code, payload);

  const r = result as { output: Record<string, unknown> };

  if (!r?.output || typeof r.output !== "object") {
    throw new Error(
      "Mapping plugin returned unexpected shape. Expected { output }",
    );
  }

  return {
    output: r.output,
    logs,
    durationMs: Date.now() - start,
  };
}

// ── Public orchestrator ───────────────────────────────────────────────────────

export interface PluginRef {
  id: string;
  code: string;
}

export interface RunTestOptions {
  payload: string;
  validation?: PluginRef | null;
  mapping?: PluginRef | null;
  // outpost is skipped in test mode — just noted
}

export async function runPluginTest(
  opts: RunTestOptions,
): Promise<RunPluginTestResponse> {
  let parsedPayload: Record<string, unknown>;

  try {
    parsedPayload = JSON.parse(opts.payload);
  } catch {
    return {
      ok: false,
      stages: {},
      allPassed: false,
      error: "Payload is not valid JSON",
    };
  }

  const stages: RunPluginTestResponse["stages"] = {};
  let currentPayload = parsedPayload;
  let allPassed = true;

  // ── Validation ──
  if (opts.validation) {
    try {
      const vResult = await runValidation(opts.validation.code, currentPayload);
      stages.validation = vResult;
      if (!vResult.passed || vResult.checks.some((c) => c.status === "fail")) {
        allPassed = false;
      }
      // Pass enriched output forward to mapping
      currentPayload = vResult.output;
    } catch (err) {
      stages.validation = {
        passed: false,
        checks: [
          {
            rule: "execution",
            status: "fail",
            message: (err as Error).message,
          },
        ],
        output: currentPayload,
        logs: [],
        durationMs: 0,
      };
      allPassed = false;
      // Don't proceed to mapping if validation threw
      return { ok: true, stages, allPassed };
    }
  }

  // ── Mapping ──
  if (opts.mapping) {
    try {
      const mResult = await runMapping(opts.mapping.code, currentPayload);
      stages.mapping = mResult;
    } catch (err) {
      stages.mapping = {
        output: {},
        logs: [(err as Error).message],
        durationMs: 0,
      };
      allPassed = false;
    }
  }

  return { ok: true, stages, allPassed };
}
