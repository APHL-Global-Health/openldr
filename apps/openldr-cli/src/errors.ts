export const ERROR_CODES = {
  USAGE: { code: "USAGE", exit: 2, description: "Invalid arguments or usage" },
  MISSING_FLAG: { code: "MISSING_FLAG", exit: 2, description: "A required flag was not provided" },
  UNKNOWN_TARGET: { code: "UNKNOWN_TARGET", exit: 2, description: "Service, table, topic, bucket, or index not recognised" },
  NOT_SUPPORTED: { code: "NOT_SUPPORTED", exit: 2, description: "Requested operation not supported in this context" },
  CONFIG_MISSING: { code: "CONFIG_MISSING", exit: 3, description: "Required env var or flag not configured" },
  CONFIG_INVALID: { code: "CONFIG_INVALID", exit: 3, description: "Config value failed validation" },
  ENV_FILE_UNREADABLE: { code: "ENV_FILE_UNREADABLE", exit: 3, description: "Specified --env-file path could not be read" },
  DB_CONNECT_FAILED: { code: "DB_CONNECT_FAILED", exit: 4, description: "Could not connect to PostgreSQL" },
  DB_QUERY_FAILED: { code: "DB_QUERY_FAILED", exit: 4, description: "PostgreSQL returned an error while executing the query" },
  QUEUE_CONNECT_FAILED: { code: "QUEUE_CONNECT_FAILED", exit: 5, description: "Could not connect to the message queue (Kafka)" },
  QUEUE_OP_FAILED: { code: "QUEUE_OP_FAILED", exit: 5, description: "Queue operation failed (admin, consumer, or producer)" },
  NOT_FOUND: { code: "NOT_FOUND", exit: 6, description: "Requested object, row, or resource does not exist" },
  AUTH_FAILED: { code: "AUTH_FAILED", exit: 7, description: "Authentication failed (token fetch, credentials, expired session)" },
  GATEWAY_5XX: { code: "GATEWAY_5XX", exit: 8, description: "Upstream service returned 5xx after retries" },
  GATEWAY_4XX: { code: "GATEWAY_4XX", exit: 9, description: "Upstream service rejected the request (4xx, excluding 429)" },
  TIMEOUT: { code: "TIMEOUT", exit: 10, description: "Operation exceeded the configured timeout (e.g. `runs follow`)" },
  QUARANTINED: { code: "QUARANTINED", exit: 11, description: "Payload tripped a data-quality gate and was quarantined instead of submitted" },
  WRITE_NOT_CONFIRMED: { code: "WRITE_NOT_CONFIRMED", exit: 12, description: "Mutating command attempted without --confirm / --allow-write" },
  S3_OP_FAILED: { code: "S3_OP_FAILED", exit: 13, description: "Object storage operation failed" },
  SEARCH_OP_FAILED: { code: "SEARCH_OP_FAILED", exit: 14, description: "Search backend operation failed" },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.details = details;
  }

  get exitCode(): number {
    return ERROR_CODES[this.code].exit;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export function formatError(err: unknown): { json: string; exitCode: number } {
  if (err instanceof CliError) {
    return { json: JSON.stringify(err.toJSON()), exitCode: err.exitCode };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { json: JSON.stringify({ error: { code: "UNKNOWN", message } }), exitCode: 1 };
}
