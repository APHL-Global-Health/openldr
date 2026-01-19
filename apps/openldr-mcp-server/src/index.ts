import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "./lib/inMemoryEventStore";
import { z } from "zod";
import { DynamicModelManager } from "@openldr/internal-database";
import * as Minio from "minio";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import KcAdminClient from "@keycloak/keycloak-admin-client";
import axios, { AxiosInstance } from "axios";
import { Kafka, Admin, Producer, Consumer, KafkaConfig } from "kafkajs";
import { fn } from "@sequelize/core";
import type { Request, Response } from "express";
import express from "express";
import cors from "cors";

const ENV = process.env;
const IsDev = false; //ENV.MODE === "development";

let keycloakClient: KcAdminClient | null = null;
let modelManager: DynamicModelManager | null = null;
let minioClient: Minio.Client | null = null;
let opensearchClient: OpenSearchClient | null = null;
let apisixClient: AxiosInstance | null = null;
let kafkaClient: Kafka | null = null;
let kafkaAdmin: Admin | null = null;
let kafkaProducer: Producer | null = null;

// Track initialization state
let isInitializing = false;
let isInitialized = false;
let initError: Error | null = null;

// Check for OAuth flag
const useOAuth = process.argv.includes("--oauth");
const strictOAuth = process.argv.includes("--oauth-strict");

function getTotalHits(
  total: number | { value: number; relation: string } | undefined
): number {
  if (typeof total === "number") {
    return total;
  }
  if (total && typeof total === "object" && "value" in total) {
    return total.value;
  }
  return 0;
}

// Add helper function to initialize Kafka
async function getKafkaClient(): Promise<Kafka> {
  if (!kafkaClient) {
    const brokers = IsDev
      ? [process.env.KAFKA_BROKERS || "localhost:29092"]
      : ["openldr-kafka1:19092"];

    console.error(
      `Initializing Kafka client with brokers: ${brokers.join(", ")}`
    );

    const kafkaConfig: KafkaConfig = {
      clientId: process.env.KAFKA_CLIENT_ID || "openldr-mcp-server",
      brokers: brokers,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
      // // Custom broker discovery to handle host.docker.internal on Linux
      // ...((IsDev && {
      //   // On development/host environment, resolve host.docker.internal to localhost
      //   socketFactory: ({ host, port, ssl, onConnect }: any) => {
      //     // Replace host.docker.internal with localhost
      //     const resolvedHost =
      //       host === "host.docker.internal" ? "localhost" : host;

      //     const net = require("net");
      //     const socket = net.connect({
      //       host: resolvedHost,
      //       port,
      //     });

      //     socket.on("connect", () => {
      //       console.error(`Connected to Kafka broker: ${resolvedHost}:${port}`);
      //       if (onConnect) onConnect();
      //     });

      //     return socket;
      //   },
      // }) ||
      //   {}),
    };

    kafkaClient = new Kafka(kafkaConfig);
    console.error("Kafka client created successfully");
  }
  return kafkaClient;
}

async function getKafkaAdmin(): Promise<Admin> {
  if (!kafkaAdmin) {
    try {
      const kafka = await getKafkaClient();
      kafkaAdmin = kafka.admin();
      console.error("Connecting Kafka admin...");
      await kafkaAdmin.connect();
      console.error("Kafka admin connected successfully");
    } catch (error: any) {
      console.error("Failed to connect Kafka admin:", error.message);
      kafkaAdmin = null;
      throw error;
    }
  }
  return kafkaAdmin;
}

async function getKafkaProducer(): Promise<Producer> {
  if (!kafkaProducer) {
    try {
      const kafka = await getKafkaClient();
      kafkaProducer = kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
      });
      console.error("Connecting Kafka producer...");
      await kafkaProducer.connect();
      console.error("Kafka producer connected successfully");
    } catch (error: any) {
      console.error("Failed to connect Kafka producer:", error.message);
      kafkaProducer = null;
      throw error;
    }
  }
  return kafkaProducer;
}

process.on("SIGTERM", async () => {
  console.error("SIGTERM received, closing Kafka connections...");
  try {
    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      console.error("Kafka producer disconnected");
    }
    if (kafkaAdmin) {
      await kafkaAdmin.disconnect();
      console.error("Kafka admin disconnected");
    }
  } catch (error) {
    console.error("Error during Kafka cleanup:", error);
  }
});

async function getApisixClient(): Promise<AxiosInstance> {
  if (!apisixClient) {
    apisixClient = axios.create({
      baseURL: IsDev
        ? ENV.APISIX_ADMIN_URL || "http://localhost:9180/apisix/admin"
        : "http://openldr-apisix:9180/apisix/admin",
      headers: {
        "X-API-KEY": ENV.APISIX_ADMIN_KEY || "edd1c9f034335f136f87ad84b625c8f1",
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }
  return apisixClient;
}

async function initKeycloak() {
  if (!keycloakClient) {
    try {
      keycloakClient = new KcAdminClient({
        baseUrl: IsDev
          ? process.env.KEYCLOAK_BASE_URL || "http://localhost:8080/keycloak"
          : "https://openldr-keycloak:8443/keycloak",
        realmName: "master",
      });

      // Authenticate with admin credentials
      await keycloakClient.auth({
        username: process.env.KEYCLOAK_ADMIN_USER || "openldr",
        password: process.env.KEYCLOAK_ADMIN_PASSWORD || "openldr123",
        grantType: "password",
        clientId: "admin-cli",
      });
    } catch (error: any) {
      console.error("Keycloak connection failed:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      throw new Error(`Keycloak connection failed: ${error.message}`);
    }
  }
  return keycloakClient;
}

// Helper to re-authenticate if token expires
async function ensureKeycloakAuth() {
  const client = await initKeycloak();
  // Re-authenticate if needed (tokens expire)
  try {
    await client.users.find({ max: 1 }); // Test call
  } catch (error: any) {
    if (error.response?.status === 401) {
      await client.auth({
        username: process.env.KEYCLOAK_ADMIN_USERNAME || "openldr",
        password: process.env.KEYCLOAK_ADMIN_PASSWORD || "openldr123",
        grantType: "password",
        clientId: "admin-cli",
      });
    }
  }
  return client;
}

// Lazy initialization function
async function ensureInitialized() {
  // If already initialized, return immediately
  if (isInitialized && modelManager && minioClient && opensearchClient) {
    return;
  }

  // If initialization failed before, throw the error
  if (initError) {
    throw initError;
  }

  // If already initializing, wait for it to complete
  if (isInitializing) {
    // Wait for initialization to complete (poll every 100ms)
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (initError) throw initError;
    return;
  }

  // Start initialization
  isInitializing = true;

  try {
    console.error("Initializing services...");

    const common = {
      database: "openldr",
      user: "openldr",
      password: "openldr123",
      pool: {
        maxConnections: 5,
        maxIdleTime: 3000,
      },
    };

    const config = {
      dialect: "postgres",
      database: common.database,
      user: common.user,
      password: common.password,
      host: IsDev ? "localhost" : "openldr-db-postgres",
      port: 5432,
      pool: common.pool,
    };

    modelManager = await DynamicModelManager.custom(config, false);
    console.error("Database connected");

    minioClient = new Minio.Client({
      endPoint: IsDev ? "localhost" : "openldr-minio",
      port: IsDev ? 7000 : 9000,
      accessKey: process.env.ENTITY_SERVICES_MINIO_ACCESS_KEY,
      secretKey: process.env.ENTITY_SERVICES_MINIO_SECRET_KEY,
      useSSL: false,
    } as any);
    console.error("MinIO connected");

    opensearchClient = new OpenSearchClient({
      node: IsDev ? "http://localhost:9200" : "http://openldr-opensearch:9200",
      ssl: {
        rejectUnauthorized: false,
      },
    });

    // Test connection
    await opensearchClient.info();
    console.error("OpenSearch connected");

    isInitialized = true;
    console.error("All services initialized successfully");
  } catch (error: any) {
    initError = error;
    console.error("Service initialization failed:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

// Getter functions with lazy initialization
async function getModelManager(): Promise<DynamicModelManager> {
  await ensureInitialized();
  if (!modelManager) {
    throw new Error("Model manager not initialized");
  }
  return modelManager;
}

async function getMinioClient(): Promise<Minio.Client> {
  await ensureInitialized();
  if (!minioClient) {
    throw new Error("MinIO client not initialized");
  }
  return minioClient;
}

async function getOpenSearchClient(): Promise<OpenSearchClient> {
  await ensureInitialized();
  if (!opensearchClient) {
    throw new Error("OpenSearch client not initialized");
  }
  return opensearchClient;
}

export const init = async () => {
  await ensureInitialized();
};

// Create an MCP server instance
const getServer = () => {
  const server = new McpServer(
    {
      name: "OpenLDR MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Register health check tool
  server.registerTool(
    "health_check",
    {
      description:
        "Check server initialization status and service availability",
      inputSchema: {},
      annotations: {
        title: "Health Check",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const status = {
        serverReady: true,
        initialized: isInitialized,
        initializing: isInitializing,
        services: {
          database: !!modelManager,
          minio: !!minioClient,
          opensearch: !!opensearchClient,
          keycloak: !!keycloakClient,
        },
        error: initError?.message || null,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }
  );

  // ========== POSTGRES TOOLS ==========
  server.registerTool(
    "list_tables",
    {
      description: "List all available database tables in OpenLDR",
      inputSchema: {},
      annotations: {
        title: "List Tables",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const manager = await getModelManager();
      const tables = await manager.getAllTables();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ tables, count: tables.length }, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_table_columns",
    {
      description: "Get column information for a specific table",
      inputSchema: {
        table_name: z.string().describe("Name of the table to inspect"),
      },
      annotations: {
        title: "Get Table Columns",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const columns = await manager.getColums(params.table_name);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { table: params.table_name, columns },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "query_data",
    {
      description:
        "Query data from any table with filters, pagination, and sorting",
      inputSchema: {
        table_name: z.string().describe("Name of the table to query"),
        limit: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of records to return (default: 100)"),
        offset: z
          .number()
          .default(0)
          .optional()
          .describe("Number of records to skip (default: 0)"),
        where: z
          .record(z.string(), z.any())
          .optional()
          .describe("Filter conditions as key-value pairs"),
        order: z
          .array(z.tuple([z.string(), z.enum(["ASC", "DESC"])]))
          .optional()
          .describe("Sort order as array of [field, direction] tuples"),
      },
      annotations: {
        title: "Query Data",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();

      const queryOptions: any = {
        limit: params.limit || 100,
        offset: params.offset || 0,
      };

      if (params.where) {
        queryOptions.where = params.where;
      }

      if (params.order) {
        queryOptions.order = params.order;
      }

      const { count, rows } = await manager.getData(
        params.table_name,
        queryOptions
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                table: params.table_name,
                total: count,
                returned: rows.length,
                data: rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_facilities",
    {
      description: "Query laboratory facilities with optional filters",
      inputSchema: {
        facility_code: z
          .string()
          .optional()
          .describe("Filter by facility code"),
        facility_type: z
          .string()
          .optional()
          .describe("Filter by facility type"),
        country_code: z.string().optional().describe("Filter by country code"),
        limit: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of results (default: 100)"),
      },
      annotations: {
        title: "Get Facilities",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const model = await manager.getModel("facilities");

      const where: any = {};
      if (params.facility_code) where.facilityCode = params.facility_code;
      if (params.facility_type) where.facilityType = params.facility_type;
      if (params.country_code) where.countryCode = params.country_code;

      const { count, rows } = await model.findAndCountAll({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: params.limit || 100,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: count,
                facilities: rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_data_feeds",
    {
      description: "Query data feeds with optional filters",
      inputSchema: {
        facility_id: z.string().optional().describe("Filter by facility ID"),
        project_id: z.string().optional().describe("Filter by project ID"),
        is_enabled: z.boolean().optional().describe("Filter by enabled status"),
        limit: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of results (default: 100)"),
      },
      annotations: {
        title: "Get Data Feeds",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const model = await manager.getModel("dataFeeds");

      const where: any = {};
      if (params.facility_id) where.facilityId = params.facility_id;
      if (params.project_id) where.projectId = params.project_id;
      if (params.is_enabled !== undefined) where.isEnabled = params.is_enabled;

      const { count, rows } = await model.findAndCountAll({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: params.limit || 100,
        include: ["facility", "project", "useCase"],
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: count,
                dataFeeds: rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_extensions",
    {
      description: "Query extensions/plugins from the marketplace",
      inputSchema: {
        package_id: z.string().optional().describe("Filter by package ID"),
        is_active: z.boolean().optional().describe("Filter by active status"),
        category: z.string().optional().describe("Filter by category"),
        limit: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of results (default: 100)"),
      },
      annotations: {
        title: "Get Extensions",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const model = await manager.getModel("extensions");

      const where: any = {};
      if (params.package_id) where.packageId = params.package_id;
      if (params.is_active !== undefined) where.isActive = params.is_active;

      const { count, rows } = await model.findAndCountAll({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: params.limit || 100,
        include: ["versions"],
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: count,
                extensions: rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_projects",
    {
      description: "Query projects with optional filters",
      inputSchema: {
        project_name: z.string().optional().describe("Filter by project name"),
        is_enabled: z.boolean().optional().describe("Filter by enabled status"),
        limit: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of results (default: 100)"),
      },
      annotations: {
        title: "Get Projects",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const model = await manager.getModel("projects");

      const where: any = {};
      if (params.project_name) where.projectName = params.project_name;
      if (params.is_enabled !== undefined) where.isEnabled = params.is_enabled;

      const { count, rows } = await model.findAndCountAll({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: params.limit || 100,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: count,
                projects: rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_users",
    {
      description: "Query users with optional filters",
      inputSchema: {
        email: z.string().optional().describe("Filter by email"),
        first_name: z.string().optional().describe("Filter by first name"),
        last_name: z.string().optional().describe("Filter by last name"),
        limit: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of results (default: 100)"),
      },
      annotations: {
        title: "Get Users",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const model = await manager.getModel("users");

      const where: any = {};
      if (params.email) where.email = params.email;
      if (params.first_name) where.firstName = params.first_name;
      if (params.last_name) where.lastName = params.last_name;

      const { count, rows } = await model.findAndCountAll({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: params.limit || 100,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: count,
                users: rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Register: Insert Data (CREATE)
  server.registerTool(
    "insert_data",
    {
      description: "Insert one or more records into a table",
      inputSchema: {
        table_name: z.string().describe("Name of the table"),
        records: z
          .array(z.record(z.string(), z.any()))
          .describe(
            "Array of records to insert (each record is key-value pairs)"
          ),
        returning: z
          .boolean()
          .default(true)
          .optional()
          .describe("Return the inserted records (default: true)"),
      },
      annotations: {
        title: "Insert Data",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();

      try {
        const model = await manager.getModel(params.table_name);

        // Bulk create records
        const insertedRecords = await model.bulkCreate(params.records, {
          returning: params.returning !== false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  table: params.table_name,
                  insertedCount: insertedRecords.length,
                  records:
                    params.returning !== false ? insertedRecords : undefined,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to insert data",
                table: params.table_name,
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Update Data (UPDATE)
  server.registerTool(
    "update_data",
    {
      description: "Update records in a table based on conditions",
      inputSchema: {
        table_name: z.string().describe("Name of the table"),
        values: z
          .record(z.string(), z.any())
          .describe("Fields to update with new values"),
        where: z
          .record(z.string(), z.any())
          .describe("Conditions to match records (WHERE clause)"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of records to update"),
      },
      annotations: {
        title: "Update Data",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();

      try {
        const model = await manager.getModel(params.table_name);

        // Build update options
        const updateOptions: any = {
          where: params.where,
        };

        if (params.limit) {
          updateOptions.limit = params.limit;
        }

        // Update records
        const [updatedCount] = await model.update(params.values, updateOptions);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  table: params.table_name,
                  updatedCount: updatedCount,
                  values: params.values,
                  where: params.where,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to update data",
                table: params.table_name,
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Delete Data (DELETE)
  server.registerTool(
    "delete_data",
    {
      description: "Delete records from a table based on conditions",
      inputSchema: {
        table_name: z.string().describe("Name of the table"),
        where: z
          .record(z.string(), z.any())
          .describe("Conditions to match records to delete (WHERE clause)"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of records to delete"),
        force: z
          .boolean()
          .default(false)
          .optional()
          .describe(
            "Force delete without WHERE clause (deletes all records - dangerous!)"
          ),
      },
      annotations: {
        title: "Delete Data",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();

      try {
        // Safety check: require WHERE clause unless force is true
        if (!params.where || Object.keys(params.where).length === 0) {
          if (!params.force) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: "DELETE without WHERE clause requires force: true",
                    message:
                      "To prevent accidental deletion of all records, you must either provide a WHERE clause or set force: true",
                  }),
                },
              ],
              isError: true,
            };
          }
        }

        const model = await manager.getModel(params.table_name);

        // Build delete options
        const deleteOptions: any = {
          where: params.where || {},
        };

        if (params.limit) {
          deleteOptions.limit = params.limit;
        }

        // Delete records
        const deletedCount = await model.destroy(deleteOptions);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  table: params.table_name,
                  deletedCount: deletedCount,
                  where: params.where,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to delete data",
                table: params.table_name,
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Upsert Data (INSERT or UPDATE)
  server.registerTool(
    "upsert_data",
    {
      description:
        "Insert or update records (upsert) - updates if exists, inserts if not",
      inputSchema: {
        table_name: z.string().describe("Name of the table"),
        records: z
          .array(z.record(z.string(), z.any()))
          .describe("Array of records to upsert"),
        update_on_duplicate: z
          .array(z.string())
          .optional()
          .describe(
            "Fields to update if record exists (if not specified, updates all fields)"
          ),
        conflict_fields: z
          .array(z.string())
          .optional()
          .describe("Fields to check for conflicts (unique constraints)"),
      },
      annotations: {
        title: "Upsert Data",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();

      try {
        const model = await manager.getModel(params.table_name);

        // Build upsert options
        const upsertOptions: any = {
          updateOnDuplicate: params.update_on_duplicate,
        };

        if (params.conflict_fields && params.conflict_fields.length > 0) {
          upsertOptions.conflictFields = params.conflict_fields;
        }

        // Upsert records
        const results = await model.bulkCreate(params.records, upsertOptions);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  table: params.table_name,
                  processedCount: results.length,
                  records: results,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to upsert data",
                table: params.table_name,
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Execute Raw SQL (Advanced)
  server.registerTool(
    "execute_sql",
    {
      description:
        "Execute raw SQL query (use with caution - for advanced operations)",
      inputSchema: {
        sql: z.string().describe("SQL query to execute"),
        params: z
          .array(z.any())
          .optional()
          .describe(
            "Parameters for parameterized queries (prevents SQL injection)"
          ),
        type: z
          .enum(["SELECT", "INSERT", "UPDATE", "DELETE", "RAW"])
          .default("RAW")
          .describe("Query type for optimization"),
      },
      annotations: {
        title: "Execute SQL",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();

      try {
        // Map type to Sequelize QueryTypes
        const queryTypeMap: any = {
          SELECT: "SELECT",
          INSERT: "INSERT",
          UPDATE: "UPDATE",
          DELETE: "DELETE",
          RAW: "RAW",
        };

        // Execute query
        const [results, metadata] = await manager.query(params.sql, {
          replacements: params.params || [],
          type: queryTypeMap[params.type],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  type: params.type,
                  results: results,
                  metadata: metadata,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to execute SQL",
                message: error.message,
                sql: params.sql,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Bulk Update with Transaction
  server.registerTool(
    "bulk_update_transaction",
    {
      description:
        "Update multiple records in a transaction (all succeed or all fail)",
      inputSchema: {
        operations: z
          .array(
            z.object({
              table_name: z.string().describe("Table name"),
              values: z
                .record(z.string(), z.any())
                .describe("Values to update"),
              where: z.record(z.string(), z.any()).describe("Conditions"),
            })
          )
          .describe("Array of update operations to perform"),
      },
      annotations: {
        title: "Bulk Update (Transaction)",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const sequelize = manager.getSequelize();

      try {
        const results = await sequelize.transaction(async () => {
          const list = [];

          for (const operation of params.operations) {
            const model = await manager.getModel(operation.table_name);

            const [updatedCount] = await model.update(operation.values, {
              where: operation.where,
            });

            list.push({
              table: operation.table_name,
              updatedCount,
            });
          }

          return list;
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "All updates completed successfully",
                  operations: results,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        // If the execution reaches this line, an error occurred.
        // The transaction has already been rolled back automatically by Sequelize!

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Transaction failed and was rolled back",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Count Records
  server.registerTool(
    "count_records",
    {
      description: "Count records in a table with optional filters",
      inputSchema: {
        table_name: z.string().describe("Name of the table"),
        where: z
          .record(z.string(), z.any())
          .optional()
          .describe("Filter conditions"),
        distinct: z
          .boolean()
          .default(false)
          .optional()
          .describe("Count distinct values"),
        group: z.array(z.string()).optional().describe("Group by fields"),
      },
      annotations: {
        title: "Count Records",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const manager = await getModelManager();
      const sequelize = manager.getSequelize();

      try {
        const model = await manager.getModel(params.table_name);

        const countOptions: any = {};

        if (params.where) {
          countOptions.where = params.where;
        }

        if (params.distinct) {
          countOptions.distinct = true;
        }

        if (params.group && params.group.length > 0) {
          countOptions.group = params.group;

          // For grouped counts, use findAll with count
          const results = await model.findAll({
            attributes: [...params.group, [fn("COUNT", "*"), "count"]],
            ...countOptions,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    table: params.table_name,
                    grouped: true,
                    results: results,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const count = await model.count(countOptions);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  table: params.table_name,
                  count: count,
                  where: params.where,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to count records",
                table: params.table_name,
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ========== MINIO TOOLS ==========
  server.registerTool(
    "minio_list_buckets",
    {
      description: "List all MinIO buckets (similar to S3 buckets)",
      inputSchema: {},
      annotations: {
        title: "List MinIO Buckets",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const client = await getMinioClient();
      const buckets = await client.listBuckets();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: buckets.length,
                buckets: buckets.map((b) => ({
                  name: b.name,
                  creationDate: b.creationDate,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "minio_list_files",
    {
      description:
        "List files/objects in a MinIO bucket with optional prefix filter",
      inputSchema: {
        bucket: z.string().describe("Bucket name"),
        prefix: z
          .string()
          .optional()
          .describe("Filter by prefix (folder path)"),
        recursive: z
          .boolean()
          .default(true)
          .optional()
          .describe("List recursively (default: true)"),
        max_keys: z
          .number()
          .default(1000)
          .optional()
          .describe("Maximum number of files to return (default: 1000)"),
      },
      annotations: {
        title: "List Files in Bucket",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getMinioClient();
      const objects: any[] = [];

      return new Promise((resolve, reject) => {
        const stream = client.listObjects(
          params.bucket,
          params.prefix || "",
          params.recursive !== false
        );

        stream.on("data", (obj) => {
          if (objects.length < (params.max_keys || 1000)) {
            objects.push({
              name: obj.name,
              size: obj.size,
              lastModified: obj.lastModified,
              etag: obj.etag,
            });
          }
        });

        stream.on("end", () => {
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    bucket: params.bucket,
                    prefix: params.prefix || "",
                    count: objects.length,
                    objects: objects,
                  },
                  null,
                  2
                ),
              },
            ],
          });
        });

        stream.on("error", (err) => {
          reject({
            content: [
              {
                type: "text",
                text: `Error: ${err.message}`,
              },
            ],
            isError: true,
          });
        });
      });
    }
  );

  server.registerTool(
    "minio_get_file_url",
    {
      description:
        "Generate a pre-signed URL to access/download a file from MinIO",
      inputSchema: {
        bucket: z.string().describe("Bucket name"),
        object: z.string().describe("Object/file path"),
        expiry: z
          .number()
          .default(3600)
          .optional()
          .describe("URL expiry time in seconds (default: 3600 = 1 hour)"),
      },
      annotations: {
        title: "Get File Pre-signed URL",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getMinioClient();
      const url = await client.presignedGetObject(
        params.bucket,
        params.object,
        params.expiry || 3600
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                bucket: params.bucket,
                object: params.object,
                url: url,
                expiresIn: params.expiry || 3600,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "minio_get_file_info",
    {
      description:
        "Get metadata and information about a specific file in MinIO",
      inputSchema: {
        bucket: z.string().describe("Bucket name"),
        object: z.string().describe("Object/file path"),
      },
      annotations: {
        title: "Get File Info",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getMinioClient();
      const stat = await client.statObject(params.bucket, params.object);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                bucket: params.bucket,
                object: params.object,
                size: stat.size,
                lastModified: stat.lastModified,
                etag: stat.etag,
                contentType: stat.metaData?.["content-type"],
                metadata: stat.metaData,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "minio_download_file",
    {
      description:
        "Download and return the content of a small file from MinIO (use for text files, JSON, etc.)",
      inputSchema: {
        bucket: z.string().describe("Bucket name"),
        object: z.string().describe("Object/file path"),
        max_size: z
          .number()
          .default(1048576)
          .optional()
          .describe("Maximum file size to download in bytes (default: 1MB)"),
      },
      annotations: {
        title: "Download File Content",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getMinioClient();
      const stat = await client.statObject(params.bucket, params.object);
      const maxSize = params.max_size || 1048576;

      if (stat.size > maxSize) {
        return {
          content: [
            {
              type: "text",
              text: `Error: File is too large (${stat.size} bytes). Maximum size is ${maxSize} bytes. Use minio_get_file_url to get a download link instead.`,
            },
          ],
          isError: true,
        };
      }

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        client
          .getObject(params.bucket, params.object)
          .then((stream: any) => {
            stream.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });

            stream.on("end", () => {
              const buffer = Buffer.concat(chunks);
              const content = buffer.toString("utf-8");

              resolve({
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        bucket: params.bucket,
                        object: params.object,
                        size: buffer.length,
                        content: content,
                      },
                      null,
                      2
                    ),
                  },
                ],
              });
            });

            stream.on("error", (err: Error) => {
              reject({
                content: [
                  {
                    type: "text",
                    text: `Error: ${err.message}`,
                  },
                ],
                isError: true,
              });
            });
          })
          .catch((err: Error) => {
            reject({
              content: [
                {
                  type: "text",
                  text: `Error: ${err.message}`,
                },
              ],
              isError: true,
            });
          });
      });
    }
  );

  server.registerTool(
    "minio_search_files",
    {
      description: "Search for files in MinIO by name pattern",
      inputSchema: {
        bucket: z.string().describe("Bucket name"),
        search: z.string().describe("Search term to match in file names"),
        prefix: z
          .string()
          .optional()
          .describe("Limit search to this prefix/folder"),
        case_sensitive: z
          .boolean()
          .default(false)
          .optional()
          .describe("Case sensitive search (default: false)"),
        max_results: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum results to return (default: 100)"),
      },
      annotations: {
        title: "Search Files",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getMinioClient();
      const objects: any[] = [];
      const searchTerm = params.case_sensitive
        ? params.search
        : params.search.toLowerCase();

      return new Promise((resolve, reject) => {
        const stream = client.listObjects(
          params.bucket,
          params.prefix || "",
          true
        );

        stream.on("data", (obj: any) => {
          const fileName = params.case_sensitive
            ? obj.name
            : obj.name.toLowerCase();

          if (
            fileName.includes(searchTerm) &&
            objects.length < (params.max_results || 100)
          ) {
            objects.push({
              name: obj.name,
              size: obj.size,
              lastModified: obj.lastModified,
              etag: obj.etag,
            });
          }
        });

        stream.on("end", () => {
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    bucket: params.bucket,
                    search: params.search,
                    prefix: params.prefix || "",
                    count: objects.length,
                    results: objects,
                  },
                  null,
                  2
                ),
              },
            ],
          });
        });

        stream.on("error", (err: any) => {
          reject({
            content: [
              {
                type: "text",
                text: `Error: ${err.message}`,
              },
            ],
            isError: true,
          });
        });
      });
    }
  );

  // ========== OPENSEARCH TOOLS ==========
  server.registerTool(
    "opensearch_list_indices",
    {
      description: "List all OpenSearch indices with their statistics",
      inputSchema: {
        pattern: z
          .string()
          .optional()
          .describe("Filter indices by pattern (e.g., 'lab-*')"),
      },
      annotations: {
        title: "List OpenSearch Indices",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      const pattern = params.pattern || "*";

      const response = await client.cat.indices({
        index: pattern,
        format: "json",
        bytes: "b",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: response.body.length,
                indices: response.body.map((idx: any) => ({
                  name: idx.index,
                  health: idx.health,
                  status: idx.status,
                  documentCount: parseInt(idx["docs.count"]),
                  size: idx["store.size"],
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "opensearch_get_mapping",
    {
      description: "Get the field mapping/schema for an OpenSearch index",
      inputSchema: {
        index: z.string().describe("Index name"),
      },
      annotations: {
        title: "Get Index Mapping",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      const response = await client.indices.getMapping({
        index: params.index,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                index: params.index,
                mapping: response.body[params.index]?.mappings,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "opensearch_search",
    {
      description: "Search documents in OpenSearch with query DSL",
      inputSchema: {
        index: z
          .string()
          .describe("Index name or pattern (e.g., 'lab-data-*')"),
        query: z.string().optional().describe("Simple search query string"),
        fields: z
          .array(z.string())
          .optional()
          .describe("Fields to search in (for query string search)"),
        filters: z
          .record(z.string(), z.any())
          .optional()
          .describe("Filter conditions as key-value pairs (must match)"),
        from: z
          .number()
          .default(0)
          .optional()
          .describe("Offset for pagination (default: 0)"),
        size: z
          .number()
          .default(10)
          .optional()
          .describe("Number of results to return (default: 10)"),
        sort: z
          .array(z.record(z.string(), z.enum(["asc", "desc"])))
          .optional()
          .describe("Sort order as array of field-direction objects"),
      },
      annotations: {
        title: "Search Documents",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      const body: any = {
        from: params.from || 0,
        size: params.size || 10,
      };

      if (params.query) {
        body.query = {
          query_string: {
            query: params.query,
            fields: params.fields || ["*"],
          },
        };
      } else if (params.filters && Object.keys(params.filters).length > 0) {
        body.query = {
          bool: {
            must: Object.entries(params.filters).map(([key, value]) => ({
              term: { [key]: value },
            })),
          },
        };
      } else {
        body.query = { match_all: {} };
      }

      if (params.sort) {
        body.sort = params.sort;
      }

      const response = await client.search({
        index: params.index,
        body: body,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                index: params.index,
                total: getTotalHits(response.body.hits.total),
                took: response.body.took,
                hits: response.body.hits.hits.map((hit: any) => ({
                  id: hit._id,
                  score: hit._score,
                  source: hit._source,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "opensearch_fulltext_search",
    {
      description:
        "Perform full-text search across multiple fields with fuzzy matching",
      inputSchema: {
        index: z.string().describe("Index name or pattern"),
        search_text: z.string().describe("Text to search for"),
        fields: z
          .array(z.string())
          .default(["*"])
          .optional()
          .describe("Fields to search in (default: all fields)"),
        fuzziness: z
          .string()
          .default("AUTO")
          .optional()
          .describe("Fuzziness level: 0, 1, 2, or AUTO (default: AUTO)"),
        size: z
          .number()
          .default(10)
          .optional()
          .describe("Number of results (default: 10)"),
      },
      annotations: {
        title: "Full-Text Search",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      const response = await client.search({
        index: params.index,
        body: {
          size: params.size || 10,
          query: {
            multi_match: {
              query: params.search_text,
              fields: params.fields || ["*"],
              fuzziness: params.fuzziness || "AUTO",
            },
          },
          highlight: {
            fields: params.fields?.reduce((acc, field) => {
              acc[field] = {};
              return acc;
            }, {} as any) || { "*": {} },
          },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                index: params.index,
                query: params.search_text,
                total: getTotalHits(response.body.hits.total),
                hits: response.body.hits.hits.map((hit: any) => ({
                  id: hit._id,
                  score: hit._score,
                  source: hit._source,
                  highlights: hit.highlight,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "opensearch_aggregate",
    {
      description:
        "Perform aggregations on OpenSearch data (counts, sums, averages, etc.)",
      inputSchema: {
        index: z.string().describe("Index name or pattern"),
        agg_name: z.string().describe("Name for the aggregation"),
        agg_type: z
          .enum([
            "terms",
            "date_histogram",
            "sum",
            "avg",
            "min",
            "max",
            "stats",
          ])
          .describe("Type of aggregation"),
        field: z.string().describe("Field to aggregate on"),
        size: z
          .number()
          .optional()
          .describe("Number of buckets for terms aggregation (default: 10)"),
        interval: z
          .string()
          .optional()
          .describe("Interval for date_histogram (e.g., '1d', '1h', '1M')"),
        filters: z
          .record(z.string(), z.any())
          .optional()
          .describe("Filter the data before aggregating"),
      },
      annotations: {
        title: "Aggregate Data",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      const agg: any = {};

      if (params.agg_type === "terms") {
        agg[params.agg_name] = {
          terms: {
            field: params.field,
            size: params.size || 10,
          },
        };
      } else if (params.agg_type === "date_histogram") {
        agg[params.agg_name] = {
          date_histogram: {
            field: params.field,
            interval: params.interval || "1d",
          },
        };
      } else {
        agg[params.agg_name] = {
          [params.agg_type]: {
            field: params.field,
          },
        };
      }

      const body: any = {
        size: 0,
        aggs: agg,
      };

      if (params.filters && Object.keys(params.filters).length > 0) {
        body.query = {
          bool: {
            must: Object.entries(params.filters).map(([key, value]) => ({
              term: { [key]: value },
            })),
          },
        };
      }

      const response = await client.search({
        index: params.index,
        body: body,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                index: params.index,
                aggregation: params.agg_name,
                type: params.agg_type,
                field: params.field,
                total_documents: getTotalHits(response.body.hits.total),
                results: response.body.aggregations?.[params.agg_name],
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "opensearch_get_document",
    {
      description: "Get a specific document by its ID from OpenSearch",
      inputSchema: {
        index: z.string().describe("Index name"),
        id: z.string().describe("Document ID"),
      },
      annotations: {
        title: "Get Document by ID",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      try {
        const response = await client.get({
          index: params.index,
          id: params.id,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  index: params.index,
                  id: params.id,
                  found: response.body.found,
                  source: response.body._source,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        if (error.meta?.statusCode === 404) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    index: params.index,
                    id: params.id,
                    found: false,
                    error: "Document not found",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "opensearch_count",
    {
      description: "Count documents matching a query in OpenSearch",
      inputSchema: {
        index: z.string().describe("Index name or pattern"),
        query: z
          .string()
          .optional()
          .describe("Query string to filter documents"),
        filters: z
          .record(z.string(), z.any())
          .optional()
          .describe("Filter conditions as key-value pairs"),
      },
      annotations: {
        title: "Count Documents",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getOpenSearchClient();
      const body: any = {};

      if (params.query) {
        body.query = {
          query_string: {
            query: params.query,
          },
        };
      } else if (params.filters && Object.keys(params.filters).length > 0) {
        body.query = {
          bool: {
            must: Object.entries(params.filters).map(([key, value]) => ({
              term: { [key]: value },
            })),
          },
        };
      }

      const response = await client.count({
        index: params.index,
        body: body,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                index: params.index,
                count: response.body.count,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ========== KEYCLOAK TOOLS ==========
  server.registerTool(
    "keycloak_list_users",
    {
      description: "List users in Keycloak realm",
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe("Search by username, email, first name, or last name"),
        first: z
          .number()
          .default(0)
          .optional()
          .describe("First result (pagination offset, default: 0)"),
        max: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of users to return (default: 100)"),
        email: z.string().optional().describe("Filter by exact email address"),
        username: z.string().optional().describe("Filter by username"),
        enabled: z.boolean().optional().describe("Filter by enabled status"),
      },
      annotations: {
        title: "List Keycloak Users",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const query: any = {
        realm: process.env.KEYCLOAK_REALM || "master",
        first: params.first || 0,
        max: params.max || 100,
      };

      if (params.search) query.search = params.search;
      if (params.email) query.email = params.email;
      if (params.username) query.username = params.username;
      if (params.enabled !== undefined) query.enabled = params.enabled;

      const users = await client.users.find(query);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                realm: process.env.KEYCLOAK_REALM || "master",
                count: users.length,
                users: users.map((user) => ({
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  enabled: user.enabled,
                  emailVerified: user.emailVerified,
                  createdTimestamp: user.createdTimestamp,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_get_user",
    {
      description: "Get detailed information about a specific user",
      inputSchema: {
        user_id: z.string().describe("Keycloak user ID"),
      },
      annotations: {
        title: "Get User Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const user = await client.users.findOne({
        id: params.user_id,
        realm: process.env.KEYCLOAK_REALM || "master",
      });

      if (!user) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "User not found",
                  userId: params.user_id,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  enabled: user.enabled,
                  emailVerified: user.emailVerified,
                  createdTimestamp: user.createdTimestamp,
                  attributes: user.attributes,
                  requiredActions: user.requiredActions,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_get_user_roles",
    {
      description: "Get roles assigned to a specific user",
      inputSchema: {
        user_id: z.string().describe("Keycloak user ID"),
      },
      annotations: {
        title: "Get User Roles",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const realmRoles = await client.users.listRealmRoleMappings({
        id: params.user_id,
        realm: process.env.KEYCLOAK_REALM || "master",
      });

      const clients = await client.clients.find({
        realm: process.env.KEYCLOAK_REALM || "master",
      });

      const clientRoles: any = {};
      for (const clientObj of clients) {
        if (clientObj.id) {
          const roles = await client.users.listClientRoleMappings({
            id: params.user_id,
            clientUniqueId: clientObj.id,
            realm: process.env.KEYCLOAK_REALM || "master",
          });
          if (roles.length > 0) {
            clientRoles[clientObj.clientId || clientObj.id] = roles;
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                userId: params.user_id,
                realmRoles: realmRoles,
                clientRoles: clientRoles,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_get_user_groups",
    {
      description: "Get groups that a user belongs to",
      inputSchema: {
        user_id: z.string().describe("Keycloak user ID"),
      },
      annotations: {
        title: "Get User Groups",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const groups = await client.users.listGroups({
        id: params.user_id,
        realm: process.env.KEYCLOAK_REALM || "master",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                userId: params.user_id,
                count: groups.length,
                groups: groups.map((group) => ({
                  id: group.id,
                  name: group.name,
                  path: group.path,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_list_roles",
    {
      description: "List all realm roles in Keycloak",
      inputSchema: {
        search: z.string().optional().describe("Search roles by name"),
        first: z.number().optional().describe("First result (pagination)"),
        max: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of roles (default: 100)"),
      },
      annotations: {
        title: "List Realm Roles",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const query: any = {
        realm: process.env.KEYCLOAK_REALM || "master",
        max: params.max || 100,
      };

      if (params.search) query.search = params.search;
      if (params.first !== undefined) query.first = params.first;

      const roles = await client.roles.find(query);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                realm: process.env.KEYCLOAK_REALM || "master",
                count: roles.length,
                roles: roles.map((role) => ({
                  id: role.id,
                  name: role.name,
                  description: role.description,
                  composite: role.composite,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_list_groups",
    {
      description: "List all groups in Keycloak realm",
      inputSchema: {
        search: z.string().optional().describe("Search groups by name"),
        first: z.number().optional().describe("First result (pagination)"),
        max: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of groups (default: 100)"),
      },
      annotations: {
        title: "List Groups",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const query: any = {
        realm: process.env.KEYCLOAK_REALM || "master",
        max: params.max || 100,
      };

      if (params.search) query.search = params.search;
      if (params.first !== undefined) query.first = params.first;

      const groups = await client.groups.find(query);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                realm: process.env.KEYCLOAK_REALM || "master",
                count: groups.length,
                groups: groups.map((group) => ({
                  id: group.id,
                  name: group.name,
                  path: group.path,
                  subGroupCount: group.subGroupCount,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_get_group_members",
    {
      description: "Get all members of a specific group",
      inputSchema: {
        group_id: z.string().describe("Keycloak group ID"),
        first: z
          .number()
          .default(0)
          .optional()
          .describe("First result (pagination, default: 0)"),
        max: z
          .number()
          .default(100)
          .optional()
          .describe("Maximum number of members (default: 100)"),
      },
      annotations: {
        title: "Get Group Members",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const members = await client.groups.listMembers({
        id: params.group_id,
        realm: process.env.KEYCLOAK_REALM || "master",
        first: params.first || 0,
        max: params.max || 100,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                groupId: params.group_id,
                count: members.length,
                members: members.map((user) => ({
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  enabled: user.enabled,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_list_clients",
    {
      description: "List all clients configured in Keycloak realm",
      inputSchema: {
        client_id: z.string().optional().describe("Filter by client ID"),
        search: z.string().optional().describe("Search clients"),
      },
      annotations: {
        title: "List Clients",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const query: any = {
        realm: process.env.KEYCLOAK_REALM || "master",
      };

      if (params.client_id) query.clientId = params.client_id;
      if (params.search) query.search = params.search;

      const clients = await client.clients.find(query);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                realm: process.env.KEYCLOAK_REALM || "master",
                count: clients.length,
                clients: clients.map((c) => ({
                  id: c.id,
                  clientId: c.clientId,
                  name: c.name,
                  enabled: c.enabled,
                  protocol: c.protocol,
                  publicClient: c.publicClient,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "keycloak_check_user_role",
    {
      description: "Check if a user has a specific realm role",
      inputSchema: {
        user_id: z.string().describe("Keycloak user ID"),
        role_name: z.string().describe("Role name to check"),
      },
      annotations: {
        title: "Check User Has Role",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await ensureKeycloakAuth();

      const roles = await client.users.listRealmRoleMappings({
        id: params.user_id,
        realm: process.env.KEYCLOAK_REALM || "master",
      });

      const hasRole = roles.some((role) => role.name === params.role_name);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                userId: params.user_id,
                roleName: params.role_name,
                hasRole: hasRole,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ========== APISIX TOOLS ==========
  // Register: Test Kafka Connection (Diagnostic Tool)
  server.registerTool(
    "kafka_test_connection",
    {
      description: "Test Kafka connection and get broker information",
      inputSchema: {},
      annotations: {
        title: "Test Kafka Connection",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        console.error("Testing Kafka connection...");
        const admin = await getKafkaAdmin();

        console.error("Fetching cluster info...");
        const cluster = await admin.describeCluster();

        console.error("Listing topics...");
        const topics = await admin.listTopics();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  connection: "OK",
                  brokers: IsDev
                    ? [process.env.KAFKA_BROKERS || "localhost:9094"]
                    : ["openldr-kafka1:19092"],
                  cluster: {
                    clusterId: cluster.clusterId,
                    controller: cluster.controller,
                    brokerCount: cluster.brokers.length,
                    brokers: cluster.brokers.map((b) => ({
                      nodeId: b.nodeId,
                      host: b.host,
                      port: b.port,
                    })),
                  },
                  topicCount: topics.length,
                  topics: topics,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        console.error("Kafka connection test failed:", error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: "Failed to connect to Kafka",
                  message: error.message,
                  brokers: IsDev
                    ? [process.env.KAFKA_BROKERS || "localhost:9094"]
                    : ["openldr-kafka1:19092"],
                  details: error.stack,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: List All Routes
  server.registerTool(
    "apisix_list_routes",
    {
      description: "List all routes configured in APISIX API Gateway",
      inputSchema: {},
      annotations: {
        title: "List APISIX Routes",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const client = await getApisixClient();

      try {
        const response = await client.get("/routes");
        const routes = response.data?.list || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: routes.length,
                  routes: routes.map((route: any) => ({
                    id: route.value.id,
                    name: route.value.name,
                    uri: route.value.uri,
                    methods: route.value.methods,
                    upstream: route.value.upstream,
                    plugins: Object.keys(route.value.plugins || {}),
                    status: route.value.status,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list routes",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Get Route Details
  server.registerTool(
    "apisix_get_route",
    {
      description: "Get detailed information about a specific APISIX route",
      inputSchema: {
        route_id: z.string().describe("Route ID"),
      },
      annotations: {
        title: "Get Route Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getApisixClient();

      try {
        const response = await client.get(`/routes/${params.route_id}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        if (error.response?.status === 404) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Route not found",
                  routeId: params.route_id,
                }),
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    }
  );

  // Register: Create Route
  server.registerTool(
    "apisix_create_route",
    {
      description: "Create a new route in APISIX",
      inputSchema: {
        route_id: z
          .string()
          .optional()
          .describe("Optional route ID (auto-generated if not provided)"),
        name: z.string().describe("Route name"),
        uri: z.string().describe("URI path (e.g., /api/v1/service/*)"),
        methods: z
          .array(z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]))
          .describe("HTTP methods"),
        upstream_nodes: z
          .record(z.string(), z.number())
          .describe(
            "Upstream nodes as {host:port: weight} (e.g., {'service:3000': 1})"
          ),
        plugins: z
          .record(z.string(), z.any())
          .optional()
          .describe("Plugins configuration"),
        enable_cors: z
          .boolean()
          .default(true)
          .optional()
          .describe("Enable CORS plugin (default: true)"),
      },
      annotations: {
        title: "Create Route",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getApisixClient();

      const routeConfig: any = {
        name: params.name,
        uri: params.uri,
        methods: params.methods,
        upstream: {
          type: "roundrobin",
          nodes: params.upstream_nodes,
        },
        plugins: params.plugins || {},
      };

      // Add CORS if enabled
      if (params.enable_cors) {
        routeConfig.plugins.cors = {
          allow_origins: "*",
          allow_methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
          allow_headers:
            "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization",
          expose_headers: "Content-Length,Content-Range",
          max_age: 3600,
        };
      }

      try {
        const url = params.route_id ? `/routes/${params.route_id}` : "/routes";

        const response = await client.put(url, routeConfig);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  route: response.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to create route",
                message: error.response?.data || error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Update Route
  server.registerTool(
    "apisix_update_route",
    {
      description: "Update an existing APISIX route",
      inputSchema: {
        route_id: z.string().describe("Route ID to update"),
        name: z.string().optional().describe("Route name"),
        uri: z.string().optional().describe("URI path"),
        methods: z
          .array(z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]))
          .optional()
          .describe("HTTP methods"),
        upstream_nodes: z
          .record(z.string(), z.number())
          .optional()
          .describe("Upstream nodes"),
        plugins: z
          .record(z.string(), z.any())
          .optional()
          .describe("Plugins configuration"),
      },
      annotations: {
        title: "Update Route",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getApisixClient();

      try {
        // Get existing route
        const existing = await client.get(`/routes/${params.route_id}`);
        const currentRoute = existing.data.value;

        // Merge with updates
        const updatedRoute = {
          ...currentRoute,
          ...(params.name && { name: params.name }),
          ...(params.uri && { uri: params.uri }),
          ...(params.methods && { methods: params.methods }),
          ...(params.upstream_nodes && {
            upstream: {
              ...currentRoute.upstream,
              nodes: params.upstream_nodes,
            },
          }),
          ...(params.plugins && { plugins: params.plugins }),
        };

        const response = await client.put(
          `/routes/${params.route_id}`,
          updatedRoute
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  route: response.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to update route",
                message: error.response?.data || error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Delete Route
  server.registerTool(
    "apisix_delete_route",
    {
      description: "Delete an APISIX route",
      inputSchema: {
        route_id: z.string().describe("Route ID to delete"),
      },
      annotations: {
        title: "Delete Route",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getApisixClient();

      try {
        await client.delete(`/routes/${params.route_id}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Route ${params.route_id} deleted successfully`,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to delete route",
                message: error.response?.data || error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: List Upstreams
  server.registerTool(
    "apisix_list_upstreams",
    {
      description: "List all upstream services configured in APISIX",
      inputSchema: {},
      annotations: {
        title: "List Upstreams",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const client = await getApisixClient();

      try {
        const response = await client.get("/upstreams");
        const upstreams = response.data?.list || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: upstreams.length,
                  upstreams: upstreams.map((upstream: any) => ({
                    id: upstream.value.id,
                    name: upstream.value.name,
                    type: upstream.value.type,
                    nodes: upstream.value.nodes,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list upstreams",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: List Services
  server.registerTool(
    "apisix_list_services",
    {
      description: "List all services configured in APISIX",
      inputSchema: {},
      annotations: {
        title: "List Services",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const client = await getApisixClient();

      try {
        const response = await client.get("/services");
        const services = response.data?.list || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: services.length,
                  services: services.map((service: any) => ({
                    id: service.value.id,
                    name: service.value.name,
                    upstream: service.value.upstream,
                    plugins: Object.keys(service.value.plugins || {}),
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list services",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Get APISIX Status
  server.registerTool(
    "apisix_get_status",
    {
      description: "Get APISIX gateway status and metrics",
      inputSchema: {},
      annotations: {
        title: "Get APISIX Status",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        // Try to get status from the status endpoint
        const statusClient = axios.create({
          baseURL: IsDev
            ? "http://localhost:9080"
            : "http://openldr-apisix:9080",
          timeout: 5000,
        });

        const response = await statusClient.get("/apisix/status");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to get APISIX status",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Add Plugin to Route
  server.registerTool(
    "apisix_add_plugin_to_route",
    {
      description: "Add or update a plugin on an existing route",
      inputSchema: {
        route_id: z.string().describe("Route ID"),
        plugin_name: z
          .string()
          .describe("Plugin name (e.g., 'jwt-auth', 'rate-limit', 'cors')"),
        plugin_config: z
          .record(z.string(), z.any())
          .describe("Plugin configuration"),
      },
      annotations: {
        title: "Add Plugin to Route",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getApisixClient();

      try {
        // Get existing route
        const existing = await client.get(`/routes/${params.route_id}`);
        const route = existing.data.value;

        // Add/update plugin
        route.plugins = route.plugins || {};
        route.plugins[params.plugin_name] = params.plugin_config;

        // Update route
        const response = await client.put(`/routes/${params.route_id}`, route);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Plugin ${params.plugin_name} added to route ${params.route_id}`,
                  route: response.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to add plugin",
                message: error.response?.data || error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Remove Plugin from Route
  server.registerTool(
    "apisix_remove_plugin_from_route",
    {
      description: "Remove a plugin from a route",
      inputSchema: {
        route_id: z.string().describe("Route ID"),
        plugin_name: z.string().describe("Plugin name to remove"),
      },
      annotations: {
        title: "Remove Plugin from Route",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const client = await getApisixClient();

      try {
        // Get existing route
        const existing = await client.get(`/routes/${params.route_id}`);
        const route = existing.data.value;

        // Remove plugin
        if (route.plugins && route.plugins[params.plugin_name]) {
          delete route.plugins[params.plugin_name];
        }

        // Update route
        const response = await client.put(`/routes/${params.route_id}`, route);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Plugin ${params.plugin_name} removed from route ${params.route_id}`,
                  route: response.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to remove plugin",
                message: error.response?.data || error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: List Available Plugins
  server.registerTool(
    "apisix_list_plugins",
    {
      description: "List all available APISIX plugins",
      inputSchema: {},
      annotations: {
        title: "List Available Plugins",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const client = await getApisixClient();

      try {
        const response = await client.get("/plugins/list");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: response.data.length,
                  plugins: response.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list plugins",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
  //----------------------------------------------------------------------

  // ========== KAFKA TOOLS ==========
  // Register: List Topics
  server.registerTool(
    "kafka_list_topics",
    {
      description: "List all Kafka topics",
      inputSchema: {},
      annotations: {
        title: "List Kafka Topics",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const admin = await getKafkaAdmin();

      try {
        const topics = await admin.listTopics();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: topics.length,
                  topics: topics,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list topics",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Get Topic Metadata
  server.registerTool(
    "kafka_get_topic_metadata",
    {
      description: "Get detailed metadata about Kafka topics",
      inputSchema: {
        topics: z
          .array(z.string())
          .optional()
          .describe(
            "Specific topics to get metadata for (omit for all topics)"
          ),
      },
      annotations: {
        title: "Get Topic Metadata",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        // fetchTopicMetadata requires topics to always be defined
        // If not provided, we need to list all topics first
        let topicsToFetch = params.topics;

        if (!topicsToFetch) {
          // Get all topics if none specified
          topicsToFetch = await admin.listTopics();
        }

        const metadata = await admin.fetchTopicMetadata({
          topics: topicsToFetch,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  topics: metadata.topics.map((topic) => ({
                    name: topic.name,
                    partitions: topic.partitions.map((p) => ({
                      partitionId: p.partitionId,
                      leader: p.leader,
                      replicas: p.replicas,
                      isr: p.isr,
                    })),
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to get topic metadata",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Create Topic
  server.registerTool(
    "kafka_create_topic",
    {
      description: "Create a new Kafka topic",
      inputSchema: {
        topic: z.string().describe("Topic name"),
        num_partitions: z
          .number()
          .default(3)
          .optional()
          .describe("Number of partitions (default: 3)"),
        replication_factor: z
          .number()
          .default(1)
          .optional()
          .describe("Replication factor (default: 1)"),
        config_entries: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Topic configuration (e.g., {'retention.ms': '604800000'})"
          ),
      },
      annotations: {
        title: "Create Topic",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        const topicConfig: any = {
          topic: params.topic,
          numPartitions: params.num_partitions || 3,
          replicationFactor: params.replication_factor || 1,
        };

        // Only add configEntries if provided
        if (
          params.config_entries &&
          Object.keys(params.config_entries).length > 0
        ) {
          topicConfig.configEntries = Object.entries(params.config_entries).map(
            ([name, value]) => ({
              name,
              value,
            })
          );
        }

        const result = await admin.createTopics({
          topics: [topicConfig],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: result,
                message: result
                  ? `Topic ${params.topic} created successfully`
                  : `Topic ${params.topic} already exists`,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to create topic",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Delete Topics
  server.registerTool(
    "kafka_delete_topics",
    {
      description: "Delete one or more Kafka topics",
      inputSchema: {
        topics: z.array(z.string()).describe("Topic names to delete"),
      },
      annotations: {
        title: "Delete Topics",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        await admin.deleteTopics({
          topics: params.topics,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Topics deleted: ${params.topics.join(", ")}`,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to delete topics",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Publish Message
  server.registerTool(
    "kafka_publish_message",
    {
      description: "Publish a message to a Kafka topic",
      inputSchema: {
        topic: z.string().describe("Topic name"),
        messages: z
          .array(
            z.object({
              key: z.string().optional().describe("Message key"),
              value: z.string().describe("Message value (JSON string)"),
              headers: z
                .record(z.string(), z.string())
                .optional()
                .describe("Message headers"),
              partition: z.number().optional().describe("Specific partition"),
            })
          )
          .describe("Messages to publish"),
      },
      annotations: {
        title: "Publish Message",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const producer = await getKafkaProducer();

      try {
        const result = await producer.send({
          topic: params.topic,
          messages: params.messages.map((msg) => {
            const message: any = {
              value: msg.value,
            };

            // Only add optional fields if they exist
            if (msg.key !== undefined) message.key = msg.key;
            if (msg.headers !== undefined) message.headers = msg.headers;
            if (msg.partition !== undefined) message.partition = msg.partition;

            return message;
          }),
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  topic: params.topic,
                  partitions: result,
                  messageCount: params.messages.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to publish message",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: List Consumer Groups
  server.registerTool(
    "kafka_list_consumer_groups",
    {
      description: "List all Kafka consumer groups",
      inputSchema: {},
      annotations: {
        title: "List Consumer Groups",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const admin = await getKafkaAdmin();

      try {
        const groups = await admin.listGroups();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: groups.groups.length,
                  groups: groups.groups,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list consumer groups",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Describe Consumer Group
  server.registerTool(
    "kafka_describe_consumer_group",
    {
      description: "Get detailed information about a consumer group",
      inputSchema: {
        group_ids: z.array(z.string()).describe("Consumer group IDs"),
      },
      annotations: {
        title: "Describe Consumer Group",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        const groups = await admin.describeGroups(params.group_ids);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  groups: groups.groups.map((group) => ({
                    groupId: group.groupId,
                    state: group.state,
                    protocolType: group.protocolType,
                    protocol: group.protocol,
                    members: group.members.map((m) => ({
                      memberId: m.memberId,
                      clientId: m.clientId,
                      clientHost: m.clientHost,
                    })),
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to describe consumer group",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Get Topic Offsets
  server.registerTool(
    "kafka_get_topic_offsets",
    {
      description: "Get offset information for a topic",
      inputSchema: {
        topic: z.string().describe("Topic name"),
      },
      annotations: {
        title: "Get Topic Offsets",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        const offsets = await admin.fetchTopicOffsets(params.topic);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  topic: params.topic,
                  partitions: offsets.map((offset) => ({
                    partition: offset.partition,
                    offset: offset.offset,
                    high: offset.high,
                    low: offset.low,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to get topic offsets",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Fetch Consumer Group Offsets
  server.registerTool(
    "kafka_fetch_consumer_offsets",
    {
      description: "Fetch offset information for a consumer group",
      inputSchema: {
        group_id: z.string().describe("Consumer group ID"),
        topics: z
          .array(z.string())
          .optional()
          .describe("Specific topics (omit for all subscribed topics)"),
      },
      annotations: {
        title: "Fetch Consumer Offsets",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        const fetchParams: any = {
          groupId: params.group_id,
        };

        // Only add topics if provided
        if (params.topics && params.topics.length > 0) {
          fetchParams.topics = params.topics;
        }

        const offsets = await admin.fetchOffsets(fetchParams);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  groupId: params.group_id,
                  offsets: offsets,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to fetch consumer offsets",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Reset Consumer Group Offsets
  server.registerTool(
    "kafka_reset_consumer_offsets",
    {
      description: "Reset consumer group offsets to earliest or latest",
      inputSchema: {
        group_id: z.string().describe("Consumer group ID"),
        topic: z.string().describe("Topic name"),
        reset_to: z.enum(["earliest", "latest"]).describe("Reset position"),
      },
      annotations: {
        title: "Reset Consumer Offsets",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        // First, get the topic metadata to know partitions
        const metadata = await admin.fetchTopicMetadata({
          topics: [params.topic],
        });

        // Check if topic exists and has partitions
        const topicMetadata = metadata.topics?.[0];
        if (!topicMetadata || !topicMetadata.partitions) {
          throw new Error(
            `Topic ${params.topic} not found or has no partitions`
          );
        }

        const partitions = topicMetadata.partitions.map((p) => p.partitionId);

        // Reset offsets
        await admin.resetOffsets({
          groupId: params.group_id,
          topic: params.topic,
          earliest: params.reset_to === "earliest",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Offsets reset to ${params.reset_to} for group ${params.group_id} on topic ${params.topic}`,
                partitions: partitions.length,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to reset offsets",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Delete Consumer Group
  server.registerTool(
    "kafka_delete_consumer_groups",
    {
      description: "Delete one or more consumer groups",
      inputSchema: {
        group_ids: z.array(z.string()).describe("Consumer group IDs to delete"),
      },
      annotations: {
        title: "Delete Consumer Groups",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        await admin.deleteGroups(params.group_ids);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Consumer groups deleted: ${params.group_ids.join(", ")}`,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to delete consumer groups",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Get Cluster Info
  server.registerTool(
    "kafka_get_cluster_info",
    {
      description: "Get Kafka cluster information",
      inputSchema: {},
      annotations: {
        title: "Get Cluster Info",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const admin = await getKafkaAdmin();

      try {
        const cluster = await admin.describeCluster();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  clusterId: cluster.clusterId,
                  controller: cluster.controller,
                  brokers: cluster.brokers.map((broker) => ({
                    nodeId: broker.nodeId,
                    host: broker.host,
                    port: broker.port,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to get cluster info",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register: Alter Topic Configuration
  server.registerTool(
    "kafka_alter_topic_config",
    {
      description: "Modify configuration for an existing topic",
      inputSchema: {
        topic: z.string().describe("Topic name"),
        config_entries: z
          .record(z.string(), z.string())
          .describe(
            "Configuration to set (e.g., {'retention.ms': '86400000'})"
          ),
      },
      annotations: {
        title: "Alter Topic Configuration",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const admin = await getKafkaAdmin();

      try {
        await admin.alterConfigs({
          validateOnly: false, // Fix: add required validateOnly field
          resources: [
            {
              type: 2, // TOPIC
              name: params.topic,
              configEntries: Object.entries(params.config_entries).map(
                ([name, value]) => ({
                  name,
                  value,
                })
              ),
            },
          ],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Topic ${params.topic} configuration updated`,
                config: params.config_entries,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to alter topic configuration",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
  //----------------------------------------------------------------------

  return server;
};

(async () => {
  try {
    // Connect transport FIRST - this allows server to respond immediately
    // const app = createMcpExpressApp();
    const app = express();

    app.set("trust proxy", true);

    app.use(
      cors({
        origin: "*",
      })
    );
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const MCP_PORT = process.env.MCP_PORT
      ? parseInt(process.env.MCP_PORT, 10)
      : 6060;

    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } =
      {};

    // MCP POST endpoint
    const mcpPostHandler = async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
          await transport.handleRequest(req, res, req.body);
          return;
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          const eventStore = new InMemoryEventStore();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            eventStore, // Enable resumability
            onsessioninitialized: (sessionId) => {
              // Store the transport by session ID when session is initialized
              // This avoids race conditions where requests might come in before the session is stored
              console.log(`Session initialized with ID: ${sessionId}`);
              transports[sessionId] = transport;
            },
          });

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
              console.error(
                `Transport closed for session ${sid}, removing from transports map`
              );
              delete transports[sid];
            }
          };

          // Connect the transport to the MCP server BEFORE handling the request
          // so responses can flow back through the same transport
          const server = getServer();
          await server.connect(transport as any);

          await transport.handleRequest(req, res, req.body);
          return; // Already handled
        } else {
          // Invalid request - no session ID or not initialization request
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID provided",
            },
            id: null,
          });
          return;
        }
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    };

    app.post("/mcp", mcpPostHandler);

    // Handle GET requests for SSE streams
    const mcpGetHandler = async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      const lastEventId = req.headers["last-event-id"] as string | undefined;
      if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
      } else {
        console.log(`Establishing new SSE stream for session ${sessionId}`);
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    };

    app.get("/mcp", mcpGetHandler);

    // Handle DELETE requests for session termination
    const mcpDeleteHandler = async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      console.log(
        `Received session termination request for session ${sessionId}`
      );

      try {
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error("Error handling session termination:", error);
        if (!res.headersSent) {
          res.status(500).send("Error processing session termination");
        }
      }
    };

    app.delete("/mcp", mcpDeleteHandler);

    app.listen(MCP_PORT, () => {
      console.error(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
    });

    // Handle server shutdown
    process.on("SIGINT", async () => {
      console.error("Shutting down server...");

      for (const sessionId in transports) {
        try {
          console.error(`Closing transport for session ${sessionId}`);
          await transports[sessionId]!.close();
          delete transports[sessionId];
        } catch (error) {
          console.error(
            `Error closing transport for session ${sessionId}:`,
            error
          );
        }
      }

      if (kafkaProducer) {
        await kafkaProducer.disconnect();
      }
      if (kafkaAdmin) {
        await kafkaAdmin.disconnect();
      }

      console.error("Server shutdown complete");
      process.exit(0);
    });
  } catch (e) {
    console.error("MCP Server: Failed to start:", e);
    process.exit(1);
  }
})();
