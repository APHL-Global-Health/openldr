import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "./lib/inMemoryEventStore";
import {
  getExternalDatabase,
  getMainDatabase,
  disconnectAllDatabases,
} from "./lib/database.js";
import { getKafkaManager, disconnectKafka } from "./lib/kafka.js";
import type { Request, Response } from "express";
import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  getMinioClient,
  getObjectContent,
  // getObjectMetadata,
  // listObjects,
} from "./lib/minio.js";

import * as messageTracking from "./lib/messageTracking";

// Initialization state
let isInitialized = false;
let isInitializing = false;
let initError: Error | null = null;

// Service instances
let externalDb: ReturnType<typeof getExternalDatabase> | null = null;
let mainDb: ReturnType<typeof getMainDatabase> | null = null;
let kafkaManager: ReturnType<typeof getKafkaManager> | null = null;
let minioClient: ReturnType<typeof getMinioClient> | null = null;

// Initialize all services
async function initializeServices(): Promise<void> {
  if (isInitialized || isInitializing) return;

  isInitializing = true;
  console.log("Initializing OpenLDR MCP services...");

  try {
    // Initialize databases
    externalDb = getExternalDatabase();
    await externalDb.connect();

    mainDb = getMainDatabase();
    await mainDb.connect();

    // Initialize Kafka
    kafkaManager = getKafkaManager();
    await kafkaManager.connectAdmin();

    minioClient = getMinioClient();

    isInitialized = true;
    isInitializing = false;
    console.log("All services initialized successfully");
  } catch (error) {
    initError = error as Error;
    isInitializing = false;
    console.error("Service initialization failed:", error);
    throw error;
  }
}

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
    },
  );

  // ====================
  // TOOL 0: Health Check
  // ====================
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
          externalDatabase: !!externalDb,
          mainDatabase: !!mainDb,
          kafka: !!kafkaManager,
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
    },
  );

  // ==================================
  // TOOL 1: message status
  // ==================================
  server.registerTool(
    "get_message_status",
    {
      description:
        "Get the current processing status, stage, and error details for a specific message by its ID.",
      inputSchema: {
        messageId: z.string().describe("The unique message ID to look up"),
      },
      annotations: {
        title: "Get Message Status",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { messageId: string }) => {
      if (!isInitialized) {
        return {
          content: [
            {
              type: "text",
              text: "Services not initialized. Please wait and try again.",
            },
          ],
          isError: true,
        };
      }

      try {
        const run = await messageTracking.getRunByMessageId(params.messageId);
        if (!run) {
          return {
            content: [
              {
                type: "text",
                text: "Message tracking record not found",
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
                  messageId: run.messageId,
                  status: run.currentStatus,
                  currentStage: run.currentStage,
                  projectId: run.projectId,
                  dataFeedId: run.dataFeedId,
                  paths: {
                    raw: run.rawObjectPath,
                    validated: run.validatedObjectPath,
                    mapped: run.mappedObjectPath,
                    processed: run.processedObjectPath,
                  },
                  outpostStatus: run.outpostStatus,
                  error: run.errorMessage
                    ? {
                        stage: run.errorStage,
                        code: run.errorCode,
                        message: run.errorMessage,
                        details: run.errorDetails,
                      }
                    : null,
                  createdAt: run.createdAt,
                  updatedAt: run.updatedAt,
                  completedAt: run.completedAt,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 1: message events
  // ==================================
  server.registerTool(
    "get_message_events",
    {
      description:
        "Get the full event history for a specific message by its ID.",
      inputSchema: {
        messageId: z.string().describe("The unique message ID to look up"),
      },
      annotations: {
        title: "Get Message Events",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      if (!isInitialized) {
        return {
          content: [
            {
              type: "text",
              text: "Services not initialized. Please wait and try again.",
            },
          ],
          isError: true,
        };
      }

      try {
        const events = await messageTracking.getEventsByMessageId(
          params.messageId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  messageId: params.messageId,
                  count: events.length,
                  events,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 3: list recent runs (tabular)
  // ==================================
  server.registerTool(
    "list_recent_runs",
    {
      description:
        "List recent pipeline processing runs with status, project, data feed, and timing. Returns a table of runs sorted by most recent first.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Max rows to return (default 20, max 100)"),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status: queued, processing, completed, failed, deleted",
          ),
      },
      annotations: {
        title: "List Recent Runs",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { limit?: number; status?: string }) => {
      if (!isInitialized || !mainDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const limit = Math.min(params.limit ?? 20, 100);
        const values: any[] = [limit];
        let where = "";
        if (params.status) {
          where = `WHERE r."currentStatus" = $2`;
          values.push(params.status);
        }

        const sql = `
          SELECT
            r."messageId",
            r."currentStatus" AS status,
            r."currentStage" AS stage,
            p."projectName" AS project,
            df."dataFeedName" AS feed,
            r."createdAt",
            r."completedAt",
            r."errorMessage"
          FROM "messageProcessingRuns" r
          LEFT JOIN projects p ON p."projectId" = r."projectId"
          LEFT JOIN "dataFeeds" df ON df."dataFeedId" = r."dataFeedId"
          ${where}
          ORDER BY r."createdAt" DESC
          LIMIT $1
        `;

        const res = await mainDb.query(sql, values);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { count: res.rows.length, runs: res.rows },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 4: list projects
  // ==================================
  server.registerTool(
    "list_projects",
    {
      description:
        "List all projects with their use cases and data feed counts.",
      inputSchema: {},
      annotations: {
        title: "List Projects",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      if (!isInitialized || !mainDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const sql = `
          SELECT
            p."projectId",
            p."projectName",
            p.description,
            p."isEnabled",
            p."createdAt",
            COUNT(DISTINCT uc."useCaseId") AS "useCaseCount",
            COUNT(DISTINCT df."dataFeedId") AS "dataFeedCount"
          FROM projects p
          LEFT JOIN "useCases" uc ON uc."projectId" = p."projectId"
          LEFT JOIN "dataFeeds" df ON df."useCaseId" = uc."useCaseId"
          GROUP BY p."projectId"
          ORDER BY p."projectName"
        `;
        const res = await mainDb.query(sql);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { count: res.rows.length, projects: res.rows },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 5: list facilities
  // ==================================
  server.registerTool(
    "list_facilities",
    {
      description:
        "List laboratory facilities with location details. Optionally filter by country code.",
      inputSchema: {
        countryCode: z
          .string()
          .optional()
          .describe("ISO country code to filter by (e.g. TZ, KE, ZA)"),
        limit: z.number().optional().describe("Max rows (default 50, max 200)"),
      },
      annotations: {
        title: "List Facilities",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { countryCode?: string; limit?: number }) => {
      if (!isInitialized || !externalDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const limit = Math.min(params.limit ?? 50, 200);
        const values: any[] = [limit];
        let where = "";
        if (params.countryCode) {
          where = `WHERE country_code = $2`;
          values.push(params.countryCode.toUpperCase());
        }

        const sql = `
          SELECT
            facility_code,
            facility_name,
            facility_type,
            country_code,
            region,
            district,
            city,
            is_active
          FROM facilities
          ${where}
          ORDER BY facility_name
          LIMIT $1
        `;
        const res = await externalDb.query(sql, values);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { count: res.rows.length, facilities: res.rows },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 6: search concepts
  // ==================================
  server.registerTool(
    "search_concepts",
    {
      description:
        "Search the terminology/coding systems for concepts matching a query. Searches across LOINC, ICD10, WHONET, SNOMED, and other coding systems by display name or concept code.",
      inputSchema: {
        query: z
          .string()
          .describe("Search term (e.g. 'blood culture', 'AMP', 'E. coli')"),
        systemCode: z
          .string()
          .optional()
          .describe(
            "Filter to a specific coding system (e.g. LOINC, ICD10, WHONET_ORG, WHONET_ABX)",
          ),
        limit: z
          .number()
          .optional()
          .describe("Max results (default 25, max 100)"),
      },
      annotations: {
        title: "Search Concepts",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { query: string; systemCode?: string; limit?: number }) => {
      if (!isInitialized || !externalDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const limit = Math.min(params.limit ?? 25, 100);
        const searchTerm = `%${params.query}%`;
        const values: any[] = [searchTerm, searchTerm, limit];
        let systemFilter = "";
        if (params.systemCode) {
          systemFilter = `AND cs.system_code = $4`;
          values.push(params.systemCode.toUpperCase());
        }

        const sql = `
          SELECT
            c.concept_code,
            c.display_name,
            c.concept_class,
            c.datatype,
            cs.system_code,
            cs.system_name
          FROM concepts c
          JOIN coding_systems cs ON cs.id = c.system_id
          WHERE c.is_active = true
            AND (c.display_name ILIKE $1 OR c.concept_code ILIKE $2)
            ${systemFilter}
          ORDER BY
            CASE WHEN c.concept_code ILIKE $2 THEN 0 ELSE 1 END,
            c.display_name
          LIMIT $3
        `;
        const res = await externalDb.query(sql, values);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { count: res.rows.length, concepts: res.rows },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 7: get project summary
  // ==================================
  server.registerTool(
    "get_project_summary",
    {
      description:
        "Get detailed information about a project including its use cases, data feeds, assigned plugins, and recent run statistics.",
      inputSchema: {
        projectId: z.string().describe("The project UUID"),
      },
      annotations: {
        title: "Get Project Summary",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { projectId: string }) => {
      if (!isInitialized || !mainDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        // Project info
        const projRes = await mainDb.query(
          `SELECT * FROM projects WHERE "projectId" = $1`,
          [params.projectId],
        );
        if (!projRes.rows[0]) {
          return {
            content: [{ type: "text", text: "Project not found." }],
            isError: true,
          };
        }

        // Use cases with feeds
        const ucRes = await mainDb.query(
          `
          SELECT
            uc."useCaseId", uc."useCaseName", uc."isEnabled",
            df."dataFeedId", df."dataFeedName", df."isEnabled" AS "feedEnabled",
            sp."pluginName" AS "schemaPlugin",
            mp."pluginName" AS "mapperPlugin",
            stp."pluginName" AS "storagePlugin",
            op."pluginName" AS "outpostPlugin"
          FROM "useCases" uc
          LEFT JOIN "dataFeeds" df ON df."useCaseId" = uc."useCaseId"
          LEFT JOIN plugins sp ON sp."pluginId" = df."schemaPluginId"
          LEFT JOIN plugins mp ON mp."pluginId" = df."mapperPluginId"
          LEFT JOIN plugins stp ON stp."pluginId" = df."storagePluginId"
          LEFT JOIN plugins op ON op."pluginId" = df."outpostPluginId"
          WHERE uc."projectId" = $1
          ORDER BY uc."useCaseName", df."dataFeedName"
          `,
          [params.projectId],
        );

        // Run stats (last 30 days)
        const statsRes = await mainDb.query(
          `
          SELECT
            "currentStatus" AS status,
            COUNT(*) AS count
          FROM "messageProcessingRuns"
          WHERE "projectId" = $1 AND "createdAt" > NOW() - INTERVAL '30 days'
          GROUP BY "currentStatus"
          `,
          [params.projectId],
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  project: projRes.rows[0],
                  useCasesAndFeeds: ucRes.rows,
                  runStats30d: statsRes.rows,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 8: get data feed detail
  // ==================================
  server.registerTool(
    "get_data_feed_detail",
    {
      description:
        "Get detailed configuration of a data feed including all plugin assignments and recent run statistics.",
      inputSchema: {
        dataFeedId: z.string().describe("The data feed UUID"),
      },
      annotations: {
        title: "Get Data Feed Detail",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { dataFeedId: string }) => {
      if (!isInitialized || !mainDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const feedRes = await mainDb.query(
          `
          SELECT
            df.*,
            uc."useCaseName",
            p."projectName",
            sp."pluginName" AS "schemaPluginName", sp."pluginVersion" AS "schemaPluginVersion",
            mp."pluginName" AS "mapperPluginName", mp."pluginVersion" AS "mapperPluginVersion",
            stp."pluginName" AS "storagePluginName", stp."pluginVersion" AS "storagePluginVersion",
            op."pluginName" AS "outpostPluginName", op."pluginVersion" AS "outpostPluginVersion"
          FROM "dataFeeds" df
          JOIN "useCases" uc ON uc."useCaseId" = df."useCaseId"
          JOIN projects p ON p."projectId" = uc."projectId"
          LEFT JOIN plugins sp ON sp."pluginId" = df."schemaPluginId"
          LEFT JOIN plugins mp ON mp."pluginId" = df."mapperPluginId"
          LEFT JOIN plugins stp ON stp."pluginId" = df."storagePluginId"
          LEFT JOIN plugins op ON op."pluginId" = df."outpostPluginId"
          WHERE df."dataFeedId" = $1
          `,
          [params.dataFeedId],
        );

        if (!feedRes.rows[0]) {
          return {
            content: [{ type: "text", text: "Data feed not found." }],
            isError: true,
          };
        }

        // Recent runs for this feed
        const runsRes = await mainDb.query(
          `
          SELECT
            "currentStatus" AS status,
            COUNT(*) AS count
          FROM "messageProcessingRuns"
          WHERE "dataFeedId" = $1 AND "createdAt" > NOW() - INTERVAL '30 days'
          GROUP BY "currentStatus"
          `,
          [params.dataFeedId],
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  feed: feedRes.rows[0],
                  runStats30d: runsRes.rows,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 9: pipeline stats
  // ==================================
  server.registerTool(
    "get_pipeline_stats",
    {
      description:
        "Get aggregate pipeline run statistics: counts by status, daily throughput, and error rates over a configurable time range.",
      inputSchema: {
        days: z
          .number()
          .optional()
          .describe("Number of days to look back (default 7, max 90)"),
      },
      annotations: {
        title: "Get Pipeline Stats",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { days?: number }) => {
      if (!isInitialized || !mainDb) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const days = Math.min(params.days ?? 7, 90);

        // Status breakdown
        const statusRes = await mainDb.query(
          `
          SELECT "currentStatus" AS status, COUNT(*) AS count
          FROM "messageProcessingRuns"
          WHERE "createdAt" > NOW() - ($1 || ' days')::INTERVAL
          GROUP BY "currentStatus"
          ORDER BY count DESC
          `,
          [days],
        );

        // Daily throughput
        const dailyRes = await mainDb.query(
          `
          SELECT
            DATE("createdAt") AS date,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE "currentStatus" = 'completed') AS completed,
            COUNT(*) FILTER (WHERE "currentStatus" = 'failed') AS failed
          FROM "messageProcessingRuns"
          WHERE "createdAt" > NOW() - ($1 || ' days')::INTERVAL
          GROUP BY DATE("createdAt")
          ORDER BY date DESC
          `,
          [days],
        );

        // Top errors
        const errorsRes = await mainDb.query(
          `
          SELECT
            "errorStage" AS stage,
            "errorCode" AS code,
            "errorMessage" AS message,
            COUNT(*) AS count
          FROM "messageProcessingRuns"
          WHERE "currentStatus" = 'failed'
            AND "createdAt" > NOW() - ($1 || ' days')::INTERVAL
            AND "errorMessage" IS NOT NULL
          GROUP BY "errorStage", "errorCode", "errorMessage"
          ORDER BY count DESC
          LIMIT 10
          `,
          [days],
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  period: `last ${days} days`,
                  byStatus: statusRes.rows,
                  dailyThroughput: dailyRes.rows,
                  topErrors: errorsRes.rows,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 10: get object content
  // ==================================
  server.registerTool(
    "get_object_content",
    {
      description:
        "Fetch the content of an object from MinIO object storage by its bucket and key. Useful for inspecting raw, validated, mapped, or processed pipeline data.",
      inputSchema: {
        bucket: z.string().describe("The MinIO bucket name"),
        key: z.string().describe("The object key / path"),
        maxBytes: z
          .number()
          .optional()
          .describe(
            "Max bytes to return (default 8000). Large objects are truncated.",
          ),
      },
      annotations: {
        title: "Get Object Content",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { bucket: string; key: string; maxBytes?: number }) => {
      if (!isInitialized) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const content = await getObjectContent(params.bucket, params.key);
        const maxBytes = params.maxBytes ?? 8000;
        const truncated = content.length > maxBytes;
        const text = truncated
          ? content.slice(0, maxBytes) + "\n\n... [truncated]"
          : content;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  bucket: params.bucket,
                  key: params.key,
                  sizeBytes: content.length,
                  truncated,
                  content: text,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  // ==================================
  // TOOL 11: list Kafka topics
  // ==================================
  server.registerTool(
    "list_kafka_topics",
    {
      description:
        "List all Kafka topics with partition offsets. Shows the messaging backbone of the data pipeline.",
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
      if (!isInitialized || !kafkaManager) {
        return {
          content: [{ type: "text", text: "Services not initialized." }],
          isError: true,
        };
      }

      try {
        const topics = await kafkaManager.listTopics();
        // Filter out internal Kafka topics
        const userTopics = topics.filter((t) => !t.startsWith("__"));

        const topicDetails = await Promise.all(
          userTopics.map(async (topic) => {
            try {
              const offsets = await kafkaManager!.getTopicOffsets(topic);
              const totalMessages = offsets.reduce(
                (sum, p) => sum + (parseInt(p.high) - parseInt(p.low)),
                0,
              );
              return {
                topic,
                partitions: offsets.length,
                totalMessages,
                offsets,
              };
            } catch {
              return { topic, partitions: 0, totalMessages: 0, offsets: [] };
            }
          }),
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: topicDetails.length,
                  topics: topicDetails,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  return server;
};

// Connect transport FIRST - this allows server to respond immediately
const app = express();

app.set("trust proxy", true);

app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", async (_req: Request, res: Response) => {
  try {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      db: "connected",
      version: "2.0.0",
    });
  } catch {
    res.status(503).json({ status: "degraded", db: "disconnected" });
  }
});

const MCP_PORT = process.env.MCP_PORT
  ? parseInt(process.env.MCP_PORT, 10)
  : 6060;

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

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
      // Initialize services on first connection if not already done
      if (!isInitialized && !isInitializing) {
        await initializeServices().catch((err) => {
          console.error("Failed to initialize services:", err);
        });
      }

      // New initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.error(
            `Transport closed for session ${sid}, removing from transports map`,
          );
          delete transports[sid];
        }
      };

      const server = getServer();
      await server.connect(transport as any);

      await transport.handleRequest(req, res, req.body);
      return;
    } else {
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

app.post("/stream", mcpPostHandler);

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

app.get("/stream", mcpGetHandler);

// Handle DELETE requests for session termination
const mcpDeleteHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

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

app.delete("/stream", mcpDeleteHandler);

app.listen(MCP_PORT, () => {
  console.error(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
  // Initialize services after server starts
  initializeServices().catch((err) => {
    console.error("Failed to initialize services on startup:", err);
  });
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
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  // Disconnect all services
  await disconnectAllDatabases();
  await disconnectKafka();

  console.error("Server shutdown complete");
  process.exit(0);
});
