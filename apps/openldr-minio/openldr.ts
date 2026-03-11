import "dotenv/config";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { services, MinioDocker } from "@repo/openldr-core";

import type {
  MinioService,
  MinioPlugin,
  MinioBucket,
  MinioEvent,
  KafkaNotification,
} from "@repo/openldr-core/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Default plugin seed definitions ──────────────────────────────────────────
// These are the canonical bundled plugins uploaded to MinIO and registered in
// the database during system initialisation. The source files live in the
// default-plugins/ directory next to this file.

type SeedPlugin = {
  pluginId: string;
  pluginType: string;
  pluginName: string;
  pluginVersion: string;
  /** Filename used for the MinIO object */
  fileName: string;
  /** Path relative to this file's directory */
  localRelativePath: string;
  securityLevel: "low" | "medium" | "high";
  notes: string;
  status: "active" | "draft" | "inactive" | "deprecated";
};

const DEFAULT_PLUGINS: SeedPlugin[] = [
  {
    pluginId: "7f7207f2-ed04-4e49-a566-6ed244dea111",
    pluginType: "validation",
    pluginName: "default-schema",
    pluginVersion: "1.2.0",
    fileName: "default.schema.js",
    localRelativePath: "default-plugins/schema/default.schema.js",
    securityLevel: "medium",
    notes: "Bundled default schema plugin",
    status: "active",
  },
  {
    pluginId: "bb71232f-0d94-42b6-bca7-792eb954690e",
    pluginType: "validation",
    pluginName: "default-schema",
    pluginVersion: "1.1.0",
    fileName: "default.schema.1.1.0.js",
    localRelativePath: "default-plugins/schema/default.schema.1.1.0.js",
    securityLevel: "medium",
    notes: "Bundled deprecated schema plugin",
    status: "deprecated",
  },
  {
    pluginId: "fbabe1c3-f563-4634-bb41-da53f88e6cf8",
    pluginType: "mapping",
    pluginName: "default-mapper",
    pluginVersion: "1.2.0",
    fileName: "default.mapper.js",
    localRelativePath: "default-plugins/mapper/default.mapper.js",
    securityLevel: "medium",
    notes: "Bundled default mapper plugin",
    status: "active",
  },
  {
    pluginId: "6f31845c-41f9-422c-a773-d5a37d7eae2e",
    pluginType: "storage",
    pluginName: "default-storage",
    pluginVersion: "1.2.0",
    fileName: "default.storage.js",
    localRelativePath: "default-plugins/storage/default.storage.js",
    securityLevel: "medium",
    notes: "Bundled default storage plugin",
    status: "active",
  },
  {
    pluginId: "83d52575-ecf6-4d86-aa8f-30480f883a5b",
    pluginType: "outpost",
    pluginName: "default-outpost",
    pluginVersion: "1.0.0",
    fileName: "default.outpost.js",
    localRelativePath: "default-plugins/outpost/default.outpost.js",
    securityLevel: "medium",
    notes: "Bundled default outpost plugin",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000001",
    pluginType: "validation",
    pluginName: "fhir-json-schema",
    pluginVersion: "1.0.0",
    fileName: "fhir-json.schema.js",
    localRelativePath: "default-plugins/schema/fhir-json.schema.js",
    securityLevel: "medium",
    notes: "Bundled FHIR JSON (Bundle/DiagnosticReport) validation plugin",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000002",
    pluginType: "validation",
    pluginName: "hl7v2-schema",
    pluginVersion: "1.0.0",
    fileName: "hl7v2.schema.js",
    localRelativePath: "default-plugins/schema/hl7v2.schema.js",
    securityLevel: "medium",
    notes: "Bundled HL7 v2.x (ORU/ORM) pipe-delimited validation plugin",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000003",
    pluginType: "validation",
    pluginName: "fhir-xml-schema",
    pluginVersion: "1.0.0",
    fileName: "fhir-xml.schema.js",
    localRelativePath: "default-plugins/schema/fhir-xml.schema.js",
    securityLevel: "medium",
    notes: "Bundled FHIR XML (Bundle/DiagnosticReport) validation plugin",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000004",
    pluginType: "validation",
    pluginName: "csv-schema",
    pluginVersion: "1.0.0",
    fileName: "csv.schema.js",
    localRelativePath: "default-plugins/schema/csv.schema.js",
    securityLevel: "medium",
    notes: "Bundled CSV tabular lab data validation plugin",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000005",
    pluginType: "validation",
    pluginName: "generic-xml-schema",
    pluginVersion: "1.0.0",
    fileName: "generic-xml.schema.js",
    localRelativePath: "default-plugins/schema/generic-xml.schema.js",
    securityLevel: "medium",
    notes: "Bundled generic lab XML validation plugin (application/xml, text/xml)",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000006",
    pluginType: "validation",
    pluginName: "binary-schema",
    pluginVersion: "1.0.0",
    fileName: "binary.schema.js",
    localRelativePath: "default-plugins/schema/binary.schema.js",
    securityLevel: "medium",
    notes: "Bundled binary/PDF/image validation plugin (pass-through)",
    status: "active",
  },
  {
    pluginId: "a1b2c3d4-e5f6-4a7b-8c9d-100000000007",
    pluginType: "validation",
    pluginName: "text-plain-schema",
    pluginVersion: "1.0.0",
    fileName: "text-plain.schema.js",
    localRelativePath: "default-plugins/schema/text-plain.schema.js",
    securityLevel: "medium",
    notes: "Bundled plain text validation plugin (pass-through)",
    status: "active",
  },
];

// ── Minio services ────────────────────────────────────────────────────────────

const minio_services: MinioService[] = [
  {
    name: "data-processing-service",
    policies: ["object-control-policy"],
    key: "DATA_PROCESSING",
  },
  {
    name: "validation-service",
    policies: ["object-control-policy"],
    key: " VALIDATION",
  },
  {
    name: "mapper-service",
    policies: ["object-control-policy"],
    key: "MAPPER",
  },
  {
    name: "external-storage-service",
    policies: ["object-control-policy"],
    key: "EXTERNAL_STORAGE",
  },
  {
    name: "entity-services-service",
    policies: [
      "object-control-policy",
      "bucket-control-policy",
      "bucket-delete-object-delete-policy",
    ],
    key: "ENTITY_SERVICES",
  },
  {
    name: "plugin-service",
    policies: [
      "object-control-policy",
      "bucket-control-policy",
      "bucket-delete-object-delete-policy",
    ],
    key: "PLUGIN",
  },
];

const notifications: KafkaNotification[] = [
  { id: "raw-kafka-notification", topic: "raw-inbound" },
  { id: "validated-kafka-notification", topic: "validated-inbound" },
  { id: "mapped-kafka-notification", topic: "mapped-inbound" },
  { id: "processed-kafka-notification", topic: "processed-inbound" },
];

const plugins: MinioPlugin[] = [
  {
    file: "schema-validation-hl7.js",
    id: process.env.TEST_PLUGIN_SCHEMA_ID!,
    name: "schema",
  },
  {
    file: "terminology-mapping-zlab.json",
    id: process.env.TEST_PLUGIN_MAPPER_ID!,
    name: "mapper",
  },
  {
    file: "recipient-lab-data.js",
    id: process.env.TEST_PLUGIN_RECIPIENT_ID!,
    name: "recipient",
  },
  {
    file: "recipient-manual-entry-lab-data.js",
    id: process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID!,
    name: "manual entry recipient",
  },
];

const buckets: MinioBucket[] = [
  {
    id: process.env.DEFAULT_MANUAL_ENTRY_FACILITY_ID!,
    name: "DEFAULT_MANUAL_ENTRY_FACILITY",
  },
  { id: process.env.TEST_FACILITY_ID!, name: "TEST_FACILITY" },
];

const events: MinioEvent[] = [
  { prefix: "raw/", arn: "arn:minio:sqs::raw-kafka-notification:kafka" },
  {
    prefix: "validated/",
    arn: "arn:minio:sqs::validated-kafka-notification:kafka",
  },
  {
    prefix: "mapped/",
    arn: "arn:minio:sqs::mapped-kafka-notification:kafka",
  },
  {
    prefix: "processed/",
    arn: "arn:minio:sqs::processed-kafka-notification:kafka",
  },
];

const minio = new MinioDocker(
  "openldr-minio",
  process.env.MINIO_ROOT_USER!,
  process.env.MINIO_ROOT_PASSWORD!,
);

// ── Default plugin seeding ────────────────────────────────────────────────────

/**
 * Writes SQL statements to a temp file, docker-copies it into the Postgres
 * container, and runs it via psql. Avoids shell-escaping pitfalls with inline -c.
 */
const runSqlInPostgres = (sql: string): void => {
  const tmpFile = path.join(os.tmpdir(), "openldr-plugin-seed.sql");
  const pgUser = process.env.POSTGRES_USER || "postgres";
  const pgDb = process.env.POSTGRES_DB || "openldr";

  try {
    writeFileSync(tmpFile, sql, "utf8");
    execSync(`docker cp "${tmpFile}" openldr-postgres:/tmp/openldr-plugin-seed.sql`);
    execSync(
      `docker exec openldr-postgres psql -U "${pgUser}" -d "${pgDb}" -f /tmp/openldr-plugin-seed.sql`,
    );
  } finally {
    unlinkSync(tmpFile);
  }
};

/**
 * Uploads each default plugin file to the MinIO plugins bucket and upserts
 * its record in the database. Safe to run multiple times (idempotent).
 */
const seedDefaultPlugins = async (dir: string): Promise<void> => {
  console.log("Seeding default plugins to MinIO and database");

  const sqlStatements: string[] = [];

  for (const plugin of DEFAULT_PLUGINS) {
    const localPath = path.resolve(dir, plugin.localRelativePath);
    const containerTmpPath = `/tmp/openldr-plugin-${plugin.pluginId}.js`;
    const minioObjectPath = `${plugin.pluginId}/${plugin.fileName}`;

    // 1. Copy plugin file from host into the MinIO container's /tmp
    execSync(`docker cp "${localPath}" openldr-minio:${containerTmpPath}`);
    console.log(`  Copied ${plugin.pluginName} v${plugin.pluginVersion} to container`);

    // 2. Upload from container /tmp into the plugins bucket via mc
    await minio.executeMinIOCommand([
      "cp",
      containerTmpPath,
      `myminio/plugins/${minioObjectPath}`,
    ]);
    console.log(`  Uploaded to MinIO: plugins/${minioObjectPath}`);

    // 3. Build upsert SQL — using $$ quoting for notes to avoid single-quote issues
    sqlStatements.push(`
INSERT INTO plugins (
  "pluginId", "pluginType", "pluginName", "pluginVersion",
  "pluginMinioObjectPath", "securityLevel", config, notes, status, "isBundled"
) VALUES (
  '${plugin.pluginId}',
  '${plugin.pluginType}',
  '${plugin.pluginName}',
  '${plugin.pluginVersion}',
  '${minioObjectPath}',
  '${plugin.securityLevel}',
  '{}',
  $$${plugin.notes}$$,
  '${plugin.status}',
  true
)
ON CONFLICT ("pluginId") DO UPDATE SET
  "pluginMinioObjectPath" = EXCLUDED."pluginMinioObjectPath",
  "pluginVersion"         = EXCLUDED."pluginVersion",
  status                  = EXCLUDED.status,
  "isBundled"             = true;
`);
  }

  // 4. Run all upserts in a single psql call
  runSqlInPostgres(sqlStatements.join("\n"));
  console.log("Default plugin database records upserted");

  console.log("Default plugin seeding complete");
};

/**
 * Seeds a built-in project → use case → data feed with the default active
 * plugins pre-assigned. Uses fixed UUIDs so the operation is idempotent.
 *
 * Plugin IDs match the DEFAULT_PLUGINS entries above:
 *   validation : 7f7207f2-ed04-4e49-a566-6ed244dea111  (default-schema v1.2.0)
 *   mapping    : fbabe1c3-f563-4634-bb41-da53f88e6cf8  (default-mapper v1.2.0)
 *   outpost    : 83d52575-ecf6-4d86-aa8f-30480f883a5b  (default-outpost v1.0.0)
 */
const BUILTIN_PROJECT_ID  = "00000000-0000-0000-0001-000000000001";
const BUILTIN_USE_CASE_ID = "00000000-0000-0000-0001-000000000002";
const BUILTIN_FEED_ID     = "00000000-0000-0000-0001-000000000003";

const seedBuiltinProject = (): void => {
  console.log("Seeding built-in project / use case / data feed");

  const sql = `
INSERT INTO projects ("projectId", "projectName", description, "isEnabled", "createdAt", "updatedAt")
VALUES (
  '${BUILTIN_PROJECT_ID}',
  'Built-in',
  'Default built-in project with pre-configured plugins',
  true,
  NOW(), NOW()
)
ON CONFLICT ("projectId") DO NOTHING;

INSERT INTO "useCases" ("useCaseId", "useCaseName", "projectId", description, "isEnabled", "createdAt", "updatedAt")
VALUES (
  '${BUILTIN_USE_CASE_ID}',
  'Built-in',
  '${BUILTIN_PROJECT_ID}',
  'Default built-in use case',
  true,
  NOW(), NOW()
)
ON CONFLICT ("useCaseId") DO NOTHING;

INSERT INTO "dataFeeds" (
  "dataFeedId", "dataFeedName", "useCaseId",
  "schemaPluginId", "mapperPluginId", "recipientPluginId",
  "isEnabled", "isProtected", "createdAt", "updatedAt"
)
VALUES (
  '${BUILTIN_FEED_ID}',
  'Built-in',
  '${BUILTIN_USE_CASE_ID}',
  '7f7207f2-ed04-4e49-a566-6ed244dea111',
  'fbabe1c3-f563-4634-bb41-da53f88e6cf8',
  '83d52575-ecf6-4d86-aa8f-30480f883a5b',
  true, false,
  NOW(), NOW()
)
ON CONFLICT ("dataFeedId") DO UPDATE SET
  "schemaPluginId"    = EXCLUDED."schemaPluginId",
  "mapperPluginId"    = EXCLUDED."mapperPluginId",
  "recipientPluginId" = EXCLUDED."recipientPluginId";
`;

  runSqlInPostgres(sql);
  console.log("Built-in project / use case / data feed seeded");
};

// ── Lifecycle commands ────────────────────────────────────────────────────────

const setup = async (dir: string) => {
  console.log(`Running setup - ${dir}`);
};

const reset = async (dir: string) => {
  console.log(`Running reset - ${dir}`);
};

const stop = async (dir: string) => {
  console.log(`Stopping services - ${dir}`);
};

const start = async (dir: string) => {
  console.log(`Starting services - ${dir}`);

  try {
    const env = path.resolve(dir, ".env");
    if (!(await services.fileExists(env))) {
      throw new Error(
        `Could not find microservices environment file at ${env}`,
      );
    }

    await minio.waitForContainerHealth(120000);

    await minio.setupMinIOClient();
    await minio.configureMinIOAlias();
    await minio.createPolicies();
    await minio.createUsersAndAttachPolicies(env, minio_services);
    await minio.configureKafkaNotifications(notifications);

    await minio.restartMinIOContainer(dir);
    await minio.waitForContainerHealth(120000);
    await minio.createPluginsBucket();

    await seedDefaultPlugins(dir);
    seedBuiltinProject();
    await minio.createBuckets(
      [{ id: BUILTIN_PROJECT_ID, name: "built-in" }],
      events,
    );

    if (
      process.env.INCLUDE_TEST_DATA &&
      process.env.INCLUDE_TEST_DATA.toLowerCase().trim() == "true"
    ) {
      await minio.uploadPlugins(plugins);
      await minio.createBuckets(buckets, events);
    }

    await minio.restartMinIOContainer(dir);
    await minio.waitForContainerHealth(120000);

    console.log("Minio initialization complete");
  } catch (error) {
    await console.log(`Init failed: ${error}`);
    process.exit(1);
  }
};

const { command, dir } = services.processArguments(__dirname, process.argv);
switch (command) {
  case "setup":
    setup(dir);
    break;
  case "reset":
    reset(dir);
    break;
  case "stop":
    stop(dir);
    break;
  case "start":
    start(dir);
    break;
  default:
    throw new Error(`Unknown command: ${command} - ${dir}`);
}
