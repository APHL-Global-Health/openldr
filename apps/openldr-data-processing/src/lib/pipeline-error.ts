import { randomUUID } from "crypto";

export type PipelineStage = "validation" | "mapping" | "storage" | "outpost";
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

function defaultSeverity(code: string): ErrorSeverity {
  if (code.includes("VALIDATION")) return "warning";
  if (
    code.includes("SOURCE_OBJECT") ||
    code.includes("MINIO") ||
    code.includes("TIMEOUT")
  )
    return "error";
  if (code.includes("UNHANDLED") || code.includes("DATA_FEED_NOT_FOUND"))
    return "critical";
  return "error";
}

function defaultRetryable(code: string): boolean {
  return (
    code.includes("SOURCE_OBJECT") ||
    code.includes("MINIO") ||
    code.includes("TIMEOUT") ||
    code.includes("READ_FAILED")
  );
}

function buildSummary(details: Record<string, any>) {
  const summary: Record<string, any> = {};

  const validationErrors = details?.validation_details?.errors;
  if (Array.isArray(validationErrors)) {
    summary.validation_error_count = validationErrors.length;
  }

  const genericErrors = details?.errors;
  if (Array.isArray(genericErrors)) {
    summary.error_count = genericErrors.length;
  }

  const conceptRefs = details?.concept_reference_count;
  if (typeof conceptRefs === "number") {
    summary.concept_reference_count = conceptRefs;
  }

  if (
    details?.resolved_payload &&
    typeof details.resolved_payload === "object"
  ) {
    const payload = details.resolved_payload;
    summary.has_patient = Boolean(payload.patient);
    summary.has_lab_request = Boolean(payload.lab_request);
    summary.lab_result_count = Array.isArray(payload.lab_results)
      ? payload.lab_results.length
      : 0;
    summary.isolate_count = Array.isArray(payload.isolates)
      ? payload.isolates.length
      : 0;
    summary.susceptibility_test_count = Array.isArray(
      payload.susceptibility_tests,
    )
      ? payload.susceptibility_tests.length
      : 0;
  }

  return summary;
}

export class PipelineStageError extends Error {
  stage: PipelineStage;
  code: string;
  details: Record<string, any>;
  plugin: Record<string, any> | null;
  causeMessage: string | null;
  severity: ErrorSeverity;
  retryable: boolean;
  errorId: string;

  constructor(options: {
    stage: PipelineStage;
    code: string;
    message: string;
    details?: Record<string, any>;
    plugin?: Record<string, any> | null;
    cause?: any;
    severity?: ErrorSeverity;
    retryable?: boolean;
    errorId?: string;
  }) {
    super(options.message);
    this.name = "PipelineStageError";
    this.stage = options.stage;
    this.code = options.code;
    this.details = {
      ...(options.details || {}),
      summary: buildSummary(options.details || {}),
    };
    this.plugin = options.plugin || null;
    this.causeMessage = options.cause?.message || null;
    this.severity = options.severity || defaultSeverity(options.code);
    this.retryable =
      typeof options.retryable === "boolean"
        ? options.retryable
        : defaultRetryable(options.code);
    this.errorId = options.errorId || randomUUID();

    if (options.cause?.stack) {
      this.stack = `${this.name}: ${this.message}\nCaused by: ${options.cause.stack}`;
    }
  }
}

export function createStageError(options: {
  stage: PipelineStage;
  code: string;
  message: string;
  details?: Record<string, any>;
  plugin?: Record<string, any> | null;
  cause?: any;
  severity?: ErrorSeverity;
  retryable?: boolean;
  errorId?: string;
}) {
  return new PipelineStageError(options);
}

function stringifyHeaderValue(value: any): any {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value.toString();
  if (Array.isArray(value)) return value.map(stringifyHeaderValue);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function normalizeHeaders(headers: Record<string, any> | undefined) {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      stringifyHeaderValue(value),
    ]),
  );
}

export function safeParseBody(body: any) {
  if (body == null) return null;
  const asString = Buffer.isBuffer(body) ? body.toString() : String(body);
  try {
    return JSON.parse(asString);
  } catch {
    return asString;
  }
}

export function serializeError(error: any) {
  if (error instanceof PipelineStageError) {
    return {
      error_id: error.errorId,
      name: error.name,
      stage: error.stage,
      code: error.code,
      severity: error.severity,
      retryable: error.retryable,
      message: error.message,
      details: error.details,
      plugin: error.plugin,
      cause_message: error.causeMessage,
      stack: error.stack || null,
    };
  }

  return {
    error_id: randomUUID(),
    name: error?.name || "Error",
    stage: "unknown",
    code: "UNHANDLED_ERROR",
    severity: "critical",
    retryable: false,
    message: error?.message || "Unknown error",
    details: { summary: {} },
    plugin: null,
    cause_message: null,
    stack: error?.stack || null,
  };
}

export function buildDlqBody(options: {
  topic: string;
  partition: number;
  message: any;
  error: any;
  resolvedPayload?: any;
  resolvedPayloadError?: string | null;
  pluginSelection?: Record<string, any> | null;
}) {
  const serializedError: any = serializeError(options.error);
  const originalValue = safeParseBody(options.message?.value);
  const pluginSelection =
    options.pluginSelection ||
    options.resolvedPayload?._plugin_selection ||
    serializedError?.details?.plugin_selection ||
    null;

  return {
    dlq: {
      source_topic: options.topic,
      source_partition: options.partition,
      source_offset: options.message?.offset || null,
      failed_at: new Date().toISOString(),
      error: serializedError,
      plugin_selection: pluginSelection,
    },
    original_message: {
      key: options.message?.key ? options.message.key.toString() : null,
      headers: normalizeHeaders(options.message?.headers),
      value: originalValue,
      resolved_payload: options.resolvedPayload || null,
      resolved_payload_error: options.resolvedPayloadError || null,
    },
  };
}
