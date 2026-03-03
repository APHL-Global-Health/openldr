export type PipelineStage = 'validation' | 'mapping' | 'storage';

export class PipelineStageError extends Error {
  stage: PipelineStage;
  code: string;
  details: Record<string, any>;
  plugin: Record<string, any> | null;
  causeMessage: string | null;

  constructor(options: {
    stage: PipelineStage;
    code: string;
    message: string;
    details?: Record<string, any>;
    plugin?: Record<string, any> | null;
    cause?: any;
  }) {
    super(options.message);
    this.name = 'PipelineStageError';
    this.stage = options.stage;
    this.code = options.code;
    this.details = options.details || {};
    this.plugin = options.plugin || null;
    this.causeMessage = options.cause?.message || null;

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
}) {
  return new PipelineStageError(options);
}

function stringifyHeaderValue(value: any) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value.toString();
  if (Array.isArray(value)) return value.map(stringifyHeaderValue);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeHeaders(headers: Record<string, any> | undefined) {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, stringifyHeaderValue(value)]),
  );
}

function safeParseBody(body: any) {
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
      name: error.name,
      stage: error.stage,
      code: error.code,
      message: error.message,
      details: error.details,
      plugin: error.plugin,
      cause_message: error.causeMessage,
      stack: error.stack || null,
    };
  }

  return {
    name: error?.name || 'Error',
    stage: 'unknown',
    code: 'UNHANDLED_ERROR',
    message: error?.message || 'Unknown error',
    details: {},
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
}) {
  const serializedError = serializeError(options.error);

  return {
    dlq: {
      source_topic: options.topic,
      source_partition: options.partition,
      source_offset: options.message?.offset || null,
      failed_at: new Date().toISOString(),
      error: serializedError,
    },
    original_message: {
      key: options.message?.key ? options.message.key.toString() : null,
      headers: normalizeHeaders(options.message?.headers),
      value: safeParseBody(options.message?.value),
    },
  };
}
