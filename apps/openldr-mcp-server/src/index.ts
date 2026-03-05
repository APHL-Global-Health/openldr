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
  getObjectMetadata,
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
