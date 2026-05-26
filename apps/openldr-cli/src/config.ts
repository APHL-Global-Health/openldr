import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { CliError } from "./errors.js";
import { isValidFormat, type OutputFormat } from "./output.js";

/** Directory of this file at runtime. `config.ts` lives in `src/` during dev
 *  (tsx) and `dist/` after build — both are one level under the package root,
 *  so the package's `.env` (written by `copy:env`) is always at `../.env`. */
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ENV = resolve(SCRIPT_DIR, "..", ".env");

export interface LoadedConfig {
  // Postgres
  postgres: {
    host: string;
    /** Original container hostname used by --internal docker exec. */
    container: string;
    port: number;
    user: string;
    password: string;
    database: string;
    databaseExternal: string;
  };
  // Kafka (queue backend)
  kafka: {
    brokers: string[];
    /** Original container hostname used by --internal docker exec. */
    container: string;
    /** Bootstrap host:port used when running inside the kafka container. */
    internalBootstrap: string;
    clientId: string;
  };
  // MinIO (S3 backend)
  s3: {
    endpoint: string;
    /** Original container hostname used by --internal docker exec. */
    container: string;
    region: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
  };
  // OpenSearch (search backend)
  search: {
    url: string;
    container: string;
  };
  // Keycloak (auth backend)
  auth: {
    baseUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    adminUser?: string;
    adminPassword?: string;
  };
  // HTTPS gateway
  gateway: {
    url: string;
    httpPort: number;
    httpsPort: number;
  };
  // Direct service URLs (mostly for local dev — gateway is preferred)
  services: {
    dataProcessingUrl: string;
    entityServicesUrl: string;
    externalDatabasePort: number;
  };
  outputFormat: OutputFormat;
  insecureTls: boolean;
}

export interface ConfigOverrides {
  envFile?: string;
  outputFormat?: string;
  gatewayUrl?: string;
  insecureTls?: boolean;
}

const EnvSchema = z.object({
  // Postgres
  POSTGRES_HOSTNAME: z.string().optional(),
  POSTGRES_PORT: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_DB_EXTERNAL: z.string().optional(),
  // Kafka
  KAFKA_HOSTNAME: z.string().optional(),
  KAFKA_EXTERNAL_PORT: z.string().optional(),
  KAFKA_DOCKER_PORT: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().optional(),
  // MinIO / S3
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_API_PORT: z.string().optional(),
  MINIO_HOSTNAME: z.string().optional(),
  MINIO_REGION: z.string().optional(),
  MINIO_ROOT_USER: z.string().optional(),
  MINIO_ROOT_PASSWORD: z.string().optional(),
  MINIO_FORCE_PATH_STYLE: z.string().optional(),
  // OpenSearch
  OPENSEARCH_HOSTNAME: z.string().optional(),
  OPENSEARCH_PORT: z.string().optional(),
  OPENSEARCH_URL: z.string().optional(),
  // Keycloak
  KEYCLOAK_BASE_URL: z.string().optional(),
  KEYCLOAK_PUBLIC_URL: z.string().optional(),
  KEYCLOAK_REALM: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  KEYCLOAK_ADMIN_USER: z.string().optional(),
  KEYCLOAK_ADMIN_PASSWORD: z.string().optional(),
  // Gateway
  GATEWAY_URL: z.string().optional(),
  GATEWAY_HTTP_PORT: z.string().optional(),
  GATEWAY_HTTPS_PORT: z.string().optional(),
  HOST_IP: z.string().optional(),
  // Direct service URLs
  DATA_PROCESSING_PUBLIC_URL: z.string().optional(),
  DATA_PROCESSING_PORT: z.string().optional(),
  DATA_PROCESSING_HOSTNAME: z.string().optional(),
  ENTITY_SERVICES_PUBLIC_URL: z.string().optional(),
  ENTITY_SERVICES_PORT: z.string().optional(),
  ENTITY_SERVICES_HOSTNAME: z.string().optional(),
  EXTERNAL_DATABASE_PORT: z.string().optional(),
  EXTERNAL_DATABASE_HOSTNAME: z.string().optional(),
  // CLI-specific
  OPENLDR_OUTPUT: z.string().optional(),
  OPENLDR_INSECURE_TLS: z.string().optional(),
  NODE_TLS_REJECT_UNAUTHORIZED: z.string().optional(),
});

function parseBool(v: string | undefined): boolean {
  if (v === undefined) return false;
  const lower = v.trim().toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes" || lower === "on";
}

function parseInt10(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isContainerHostname(host: string | undefined): boolean {
  if (host === undefined) return false;
  return host.startsWith("openldr-");
}

function resolveLocalHost(containerHost: string | undefined, hostIp: string | undefined): string {
  // If env var points at the docker-compose internal hostname, the CLI is on the
  // operator host and needs localhost / 127.0.0.1 instead.
  if (isContainerHostname(containerHost)) return hostIp ?? "127.0.0.1";
  return containerHost ?? "127.0.0.1";
}

export function loadConfig(overrides: ConfigOverrides = {}): LoadedConfig {
  if (overrides.envFile !== undefined) {
    const envFilePath = overrides.envFile;
    let contents: string;
    try {
      contents = readFileSync(envFilePath, "utf8");
    } catch (err) {
      throw new CliError(
        "ENV_FILE_UNREADABLE",
        `Could not read env file: ${envFilePath}`,
        { cause: err instanceof Error ? err.message : String(err) },
      );
    }
    const parsed = dotenv.parse(contents);
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } else {
    // Search order (highest precedence first; dotenv only sets unset keys):
    //   1. ./.env in the current working directory (operator overrides)
    //   2. <package>/.env written by `pnpm copy:env`
    // This makes the CLI work whether the operator runs it from the package
    // directory, the repo root, or anywhere else on the filesystem.
    const cwdEnv = resolve(process.cwd(), ".env");
    if (existsSync(cwdEnv)) {
      dotenv.config({ path: cwdEnv, quiet: true });
    }
    if (PACKAGE_ENV !== cwdEnv && existsSync(PACKAGE_ENV)) {
      dotenv.config({ path: PACKAGE_ENV, quiet: true });
    }
  }

  const sanitised: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.length > 0) sanitised[k] = v;
  }
  const parsed = EnvSchema.safeParse(sanitised);
  if (!parsed.success) {
    throw new CliError("CONFIG_INVALID", "Invalid environment configuration", {
      issues: parsed.error.flatten().fieldErrors,
    });
  }
  const env = parsed.data;

  const requestedFormat = overrides.outputFormat ?? env.OPENLDR_OUTPUT ?? "ndjson";
  if (!isValidFormat(requestedFormat)) {
    throw new CliError(
      "CONFIG_INVALID",
      `Invalid output format: ${requestedFormat}. Expected one of ndjson, json, pretty, table`,
    );
  }

  const hostIp = env.HOST_IP ?? "127.0.0.1";

  const postgresHost = resolveLocalHost(env.POSTGRES_HOSTNAME, hostIp);
  const kafkaHost = resolveLocalHost(env.KAFKA_HOSTNAME, hostIp);
  const minioHost = resolveLocalHost(env.MINIO_HOSTNAME, hostIp);
  const searchHost = resolveLocalHost(env.OPENSEARCH_HOSTNAME, hostIp);

  const httpsPort = parseInt10(env.GATEWAY_HTTPS_PORT, 443);
  const httpPort = parseInt10(env.GATEWAY_HTTP_PORT, 8090);

  // Honour the OPENLDR_INSECURE_TLS / NODE_TLS_REJECT_UNAUTHORIZED env vars in
  // addition to the explicit flag.
  const insecure =
    overrides.insecureTls ??
    parseBool(env.OPENLDR_INSECURE_TLS) ??
    env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

  if (insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const gatewayUrl =
    overrides.gatewayUrl ?? env.GATEWAY_URL ?? `https://${hostIp}:${httpsPort}`;

  return {
    postgres: {
      host: postgresHost,
      container: env.POSTGRES_HOSTNAME ?? "openldr-postgres",
      port: parseInt10(env.POSTGRES_PORT, 5432),
      user: env.POSTGRES_USER ?? "postgres",
      password: env.POSTGRES_PASSWORD ?? "postgres",
      database: env.POSTGRES_DB ?? "openldr",
      databaseExternal: env.POSTGRES_DB_EXTERNAL ?? "openldr_external",
    },
    kafka: {
      brokers: [`${kafkaHost}:${parseInt10(env.KAFKA_EXTERNAL_PORT, 9094)}`],
      container: env.KAFKA_HOSTNAME ?? "openldr-kafka1",
      internalBootstrap: `localhost:${parseInt10(env.KAFKA_DOCKER_PORT, 29092)}`,
      clientId: env.KAFKA_CLIENT_ID ?? "openldr-cli",
    },
    s3: {
      endpoint:
        env.MINIO_ENDPOINT && !env.MINIO_ENDPOINT.includes("openldr-minio")
          ? env.MINIO_ENDPOINT
          : `http://${minioHost}:${parseInt10(env.MINIO_API_PORT, 9000)}`,
      container: env.MINIO_HOSTNAME ?? "openldr-minio",
      region: env.MINIO_REGION ?? "us-east-1",
      accessKey: env.MINIO_ROOT_USER ?? "minioadmin",
      secretKey: env.MINIO_ROOT_PASSWORD ?? "minioadmin",
      forcePathStyle: !parseBool(env.MINIO_FORCE_PATH_STYLE)
        ? true
        : parseBool(env.MINIO_FORCE_PATH_STYLE),
    },
    search: {
      url: env.OPENSEARCH_URL ?? `http://${searchHost}:${parseInt10(env.OPENSEARCH_PORT, 9200)}`,
      container: env.OPENSEARCH_HOSTNAME ?? "openldr-opensearch",
    },
    auth: {
      baseUrl: env.KEYCLOAK_PUBLIC_URL ?? env.KEYCLOAK_BASE_URL ?? `${gatewayUrl}/keycloak`,
      realm: env.KEYCLOAK_REALM ?? "openldr-realm",
      clientId: env.KEYCLOAK_CLIENT_ID ?? "openldr-client",
      clientSecret: env.KEYCLOAK_CLIENT_SECRET ?? "",
      adminUser: env.KEYCLOAK_ADMIN_USER,
      adminPassword: env.KEYCLOAK_ADMIN_PASSWORD,
    },
    gateway: {
      url: gatewayUrl,
      httpPort,
      httpsPort,
    },
    services: {
      dataProcessingUrl:
        env.DATA_PROCESSING_PUBLIC_URL ?? `${gatewayUrl}/data-processing`,
      entityServicesUrl:
        env.ENTITY_SERVICES_PUBLIC_URL ?? `${gatewayUrl}/entity-services`,
      externalDatabasePort: parseInt10(env.EXTERNAL_DATABASE_PORT, 3009),
    },
    outputFormat: requestedFormat,
    insecureTls: insecure,
  };
}

export function redactConfig(cfg: LoadedConfig): Record<string, unknown> {
  return {
    postgres: { ...cfg.postgres, password: "***" },
    kafka: cfg.kafka,
    s3: { ...cfg.s3, accessKey: "***", secretKey: "***" },
    search: cfg.search,
    auth: {
      ...cfg.auth,
      clientSecret: cfg.auth.clientSecret ? "***" : "",
      adminPassword: cfg.auth.adminPassword ? "***" : undefined,
    },
    gateway: cfg.gateway,
    services: cfg.services,
    outputFormat: cfg.outputFormat,
    insecureTls: cfg.insecureTls,
  };
}
