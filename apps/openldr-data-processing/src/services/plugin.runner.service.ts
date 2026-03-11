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
  type: string,
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

  let vmExec: string = "";
  if (type === "validation") {
    vmExec = `
      if (typeof validate !== 'function') throw new Error('Validation plugin must export an async function named \\'validate\\'');
      if (typeof convert !== 'function') throw new Error('Validation plugin must export an async function named \\'convert\\'');

      let res = validate(payload);
      let checks = [];
      let passed = true;

      if (res.valid) {
        checks.push({ rule: 'schema', status: 'pass', message: 'Validation passed' });
      } else {
        passed = false;
        const details = res.details?.errors || [res.reason || 'Validation failed'];
        for (const d of details) {
          checks.push({ rule: 'schema', status: 'fail', message: String(d) });
        }
      }

      let output = passed ? await convert(payload) : payload;
      result = { passed, checks, output };
    `;
  } else if (type === "mapping") {
    vmExec = `
      if (typeof map !== 'function') throw new Error('Mapping plugin must export an async function named \\'map\\'');

      result = { output: await map(payload) };
    `;
  } else if (type === "outpost") {
    vmExec = `
      if (typeof run !== 'function') throw new Error('Outpost plugin must export an async function named \\'run\\'');

      result = { output: await run(payload) };
    `;
  }

  // Wrap the plugin body so it can declare `async function run(...)` then we
  // call it and store the awaited value in `result`.
  const script = new vm.Script(`
    (async () => {
      var module = { exports: {} };
      var exports = module.exports;

      ${code}

      ${vmExec}

      return module.exports;
    })();
  `);

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
  type: string,
  code: string,
  payload: Record<string, unknown>,
): Promise<ValidationStageResult> {
  const start = Date.now();
  const { result, logs } = await execPluginCode(type, code, payload);

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
  type: string,
  code: string,
  payload: Record<string, unknown>,
): Promise<MappingStageResult> {
  const start = Date.now();
  const { result, logs } = await execPluginCode(type, code, payload);

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

async function runOutpost(
  type: string,
  code: string,
  payload: Record<string, unknown>,
): Promise<MappingStageResult> {
  const start = Date.now();
  const { result, logs } = await execPluginCode(type, code, payload);

  const r = result as { output: Record<string, unknown> };

  if (!r?.output || typeof r.output !== "object") {
    throw new Error(
      "Outpost plugin returned unexpected shape. Expected { output }",
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
  type: string;
}

export interface RunTestOptions {
  payload: string;
  contentType?: string;
  validation?: PluginRef | null;
  mapping?: PluginRef | null;
  outpost?: PluginRef | null;
}

// Content types that should be parsed as JSON before passing to plugins
const JSON_CONTENT_TYPES = new Set(["json", "application/json", "application/fhir+json"]);

export async function runPluginTest(
  opts: RunTestOptions,
): Promise<RunPluginTestResponse> {
  const ct = (opts.contentType || "json").toLowerCase();
  let parsedPayload: Record<string, unknown>;

  if (JSON_CONTENT_TYPES.has(ct)) {
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
  } else {
    // Non-JSON content types (XML, HL7, CSV, plain text, binary, etc.)
    // Pass the raw string directly — plugins handle their own parsing
    parsedPayload = opts.payload as unknown as Record<string, unknown>;
  }

  const stages: RunPluginTestResponse["stages"] = {};
  let currentPayload = parsedPayload;
  let allPassed = true;

  // ── Validation ──
  if (opts.validation) {
    try {
      const vResult = await runValidation(
        opts.validation.type,
        opts.validation.code,
        currentPayload,
      );
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
      const mResult = await runMapping(
        opts.mapping.type,
        opts.mapping.code,
        currentPayload,
      );

      stages.mapping = mResult;
      currentPayload = mResult.output;
    } catch (err) {
      stages.mapping = {
        output: {},
        logs: [(err as Error).message],
        durationMs: 0,
      };
      allPassed = false;
      return { ok: true, stages, allPassed };
    }
  }

  // ── Outpost ──
  if (opts.outpost) {
    try {
      const oResult = await runOutpost(
        opts.outpost.type,
        opts.outpost.code,
        currentPayload,
      );

      stages.outpost = oResult;
    } catch (err) {
      stages.outpost = {
        output: {},
        logs: [(err as Error).message],
        durationMs: 0,
      };
      allPassed = false;
    }
  }

  return { ok: true, stages, allPassed };
}
