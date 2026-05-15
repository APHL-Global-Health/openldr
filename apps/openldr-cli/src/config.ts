import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import { CliError } from "./errors.js";
import { isValidFormat, type OutputFormat } from "./output.js";

export interface LoadedConfig {
  // Postgres
  postgres: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    databaseExternal: string;
  };
  // Kafka (queue backend)
  kafka: {
    brokers: string[];
    clientId: string;
  };
  // MinIO (S3 backend)
  s3: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
  };
  // OpenSearch (search backend)
  search: {
    url: string;
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
  const envFilePath = overrides.envFile ?? resolve(process.cwd(), ".env");

  if (overrides.envFile !== undefined) {
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
  } else if (existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath, quiet: true });
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
      port: parseInt10(env.POSTGRES_PORT, 5432),
      user: env.POSTGRES_USER ?? "postgres",
      password: env.POSTGRES_PASSWORD ?? "postgres",
      database: env.POSTGRES_DB ?? "openldr",
      databaseExternal: env.POSTGRES_DB_EXTERNAL ?? "openldr_external",
    },
    kafka: {
      brokers: [`${kafkaHost}:${parseInt10(env.KAFKA_EXTERNAL_PORT, 9094)}`],
      clientId: env.KAFKA_CLIENT_ID ?? "openldr-cli",
    },
    s3: {
      endpoint:
        env.MINIO_ENDPOINT && !env.MINIO_ENDPOINT.includes("openldr-minio")
          ? env.MINIO_ENDPOINT
          : `http://${minioHost}:${parseInt10(env.MINIO_API_PORT, 9000)}`,
      region: env.MINIO_REGION ?? "us-east-1",
      accessKey: env.MINIO_ROOT_USER ?? "minioadmin",
      secretKey: env.MINIO_ROOT_PASSWORD ?? "minioadmin",
      forcePathStyle: !parseBool(env.MINIO_FORCE_PATH_STYLE)
        ? true
        : parseBool(env.MINIO_FORCE_PATH_STYLE),
    },
    search: {
      url: env.OPENSEARCH_URL ?? `http://${searchHost}:${parseInt10(env.OPENSEARCH_PORT, 9200)}`,
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
