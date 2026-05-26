import vm from "vm";
import https from "https";
import http from "http";
import { logger } from "../lib/logger";
import * as minioUtil from "./minio.service";
import * as pluginService from "./plugin.service";

type PluginRecord = any;

type RuntimePluginType = "validation" | "mapping" | "storage" | "outpost";

function wrapPluginSource(pluginSource: string) {
  return `
    (function() {
      var module = { exports: {} };
      var exports = module.exports;
      ${pluginSource}
      return module.exports;
    })();
  `;
}

function createBaseContext(pluginId: string) {
  return {
    console: {
      log: (...args: any[]) => logger.info(`[PLUGIN-${pluginId}]`, ...args),
      error: (...args: any[]) => logger.error(`[PLUGIN-${pluginId}]`, ...args),
      warn: (...args: any[]) => logger.warn(`[PLUGIN-${pluginId}]`, ...args),
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
  } as Record<string, any>;
}

async function makeHttpRequest(
  method: string,
  url: string,
  data: any = null,
  headers: Record<string, any> = {},
) {
  const urlObj = new URL(url);
  if (!["http:", "https:"].includes(urlObj.protocol)) {
    throw new Error(`Invalid protocol: ${urlObj.protocol}`);
  }

  return await new Promise((resolve, reject) => {
    const protocol = urlObj.protocol === "https:" ? https : http;
    const req = protocol.request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res: any) => {
        let responseData = "";
        res.on("data", (chunk: any) => (responseData += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: responseData,
            ok: res.statusCode >= 200 && res.statusCode < 300,
          });
        });
      },
    );

    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy());
    if (data) req.write(typeof data === "string" ? data : JSON.stringify(data));
    req.end();
  });
}

function getContextForPlugin(plugin: PluginRecord) {
  const context = createBaseContext(
    plugin.pluginId || plugin.pluginName || "bundled",
  );
  if (plugin.securityLevel === "high") {
    context.http = {
      request: async (method: string, url: string, data = null, headers = {}) =>
        await makeHttpRequest(method, url, data, headers),
    };
  }
  return context;
}

async function readStreamToString(stream: any): Promise<string> {
  let output = "";
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: any) => {
      output += chunk.toString();
    });
    stream.on("end", () => resolve());
    stream.on("error", (err: any) => reject(err));
  });
  return output;
}

export async function readPluginSource(plugin: PluginRecord): Promise<string> {
  if (!plugin?.pluginMinioObjectPath) {
    throw new Error(
      `Plugin ${
        plugin?.pluginId || plugin?.pluginName
      } does not have a MinIO object path`,
    );
  }

  const pluginStream = await minioUtil.getObject({
    bucketName: "plugins",
    objectName: plugin.pluginMinioObjectPath,
  });

  return await readStreamToString(pluginStream);
}

export async function readPluginSourceWithFallback(
  pluginType: RuntimePluginType,
  plugin: PluginRecord,
) {
  try {
    const pluginSource = await readPluginSource(plugin);
    return { plugin, pluginSource };
  } catch (error: any) {
    logger.warn(
      {
        pluginType,
        pluginId: plugin?.pluginId,
        pluginName: plugin?.pluginName,
        error: error.message,
      },
      "Falling back to bundled default plugin source",
    );

    const fallbackPlugin = await pluginService.getDefaultBundledPluginFromDb({
      pluginType,
    });
    const pluginSource = await readPluginSource(fallbackPlugin);
    return { plugin: fallbackPlugin, pluginSource };
  }
}

function runPluginModule(pluginSource: string, plugin: PluginRecord) {
  const wrappedScript = wrapPluginSource(pluginSource);
  if (plugin.securityLevel === "low") {
    const script = new vm.Script(wrappedScript, {
      filename: `${plugin.pluginName || plugin.pluginId || "plugin"}.js`,
    });
    return script.runInThisContext({});
  }

  const script = new vm.Script(wrappedScript, {
    filename: `${plugin.pluginName || plugin.pluginId || "plugin"}.js`,
  });
  return script.runInNewContext(getContextForPlugin(plugin), {
    timeout: 10000,
    displayErrors: true,
  });
}

async function callWithTimeout<T>(
  work: Promise<T>,
  label: string,
  timeoutMs = 5000,
): Promise<T> {
  return await Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

function normalizeValidationResult(validationResult: any) {
  if (typeof validationResult === "boolean") {
    return {
      valid: validationResult,
      reason: validationResult
        ? null
        : "Schema plugin validate(message) returned false",
      details: {},
    };
  }

  if (validationResult && typeof validationResult === "object") {
    return {
      valid: Boolean(validationResult.valid),
      reason:
        validationResult.reason ||
        (validationResult.valid ? null : "Schema validation failed"),
      details: validationResult.details || {},
    };
  }

  return {
    valid: false,
    reason: `Schema plugin returned unsupported validation response type: ${typeof validationResult}`,
    details: { returned_type: typeof validationResult },
  };
}

export async function executeValidationPlugin(
  pluginSource: string,
  messageContent: any,
  plugin: PluginRecord,
) {
  const pluginFunctions = runPluginModule(pluginSource, plugin);
  if (
    typeof pluginFunctions.validate !== "function" ||
    typeof pluginFunctions.convert !== "function"
  ) {
    throw new Error("Schema plugin must export validate and convert functions");
  }

  const validationResult = await callWithTimeout(
    Promise.resolve(pluginFunctions.validate(messageContent)),
    "Plugin validation",
  );

  const normalizedValidation = normalizeValidationResult(validationResult);
  if (!normalizedValidation.valid) {
    return {
      ok: false,
      reason: normalizedValidation.reason,
      details: normalizedValidation.details,
      converted: null,
    };
  }

  const converted = await callWithTimeout(
    Promise.resolve(pluginFunctions.convert(messageContent)),
    "Plugin conversion",
  );

  return {
    ok: true,
    reason: null,
    details: {},
    converted,
  };
}

export async function executeMapperPlugin(
  pluginSource: string,
  messageContent: any,
  plugin: PluginRecord,
) {
  const pluginFunctions = runPluginModule(pluginSource, plugin);
  const mapperFn = pluginFunctions.map || pluginFunctions.mapping;
  if (typeof mapperFn !== "function") {
    throw new Error("Mapper plugin must export map or mapping function");
  }

  const result = await callWithTimeout(
    Promise.resolve(mapperFn(messageContent)),
    "Plugin mapping",
  );
  if (result === undefined || result === null) {
    throw new Error("Mapper plugin returned null/undefined");
  }
  return result;
}

export async function executeProcessPlugin(
  pluginSource: string,
  messageContent: any,
  plugin: PluginRecord,
  stageLabel: "storage" | "outpost",
) {
  const pluginFunctions = runPluginModule(pluginSource, plugin);
  if (typeof pluginFunctions.process !== "function") {
    throw new Error(`${stageLabel} plugin must export process function`);
  }

  const result = await callWithTimeout(
    Promise.resolve(pluginFunctions.process(messageContent)),
    `${stageLabel} plugin processing`,
  );

  if (result === undefined || result === null) {
    throw new Error(`${stageLabel} plugin returned null/undefined`);
  }

  return result;
}
