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
  // TOOL 1: Check Processed Messages
  // ==================================
  server.registerTool(
    "check_processed_messages",
    {
      description:
        "Query Kafka 'processed' topic for messages with or without errors. " +
        "Shows data pipeline errors, their stages, and tracking information.",
      inputSchema: {
        has_error: z
          .boolean()
          .optional()
          .describe(
            "Filter by error presence. true=only errors, false=only successful, undefined=all",
          ),
        limit: z
          .number()
          .default(10)
          .optional()
          .describe(
            "Maximum number of messages to retrieve (default: 10, max: 100)",
          ),
        from_beginning: z
          .boolean()
          .default(false)
          .optional()
          .describe("Start reading from beginning of topic (default: false)"),
      },
      annotations: {
        title: "Check Processed Messages",
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
        const hasError = params.has_error;
        const limit = Math.min(params.limit || 10, 100);
        const fromBeginning = params.from_beginning || false;

        // Fetch messages from processed topic
        const messages = await kafkaManager!.fetchMessages("processed", {
          limit: limit * 2,
          fromBeginning,
        });

        // Parse and filter messages
        const parsedMessages = messages
          .map((msg) => {
            try {
              const value = msg.value?.toString();
              if (!value) return null;

              const parsed = JSON.parse(value);

              // Filter by error presence if specified
              if (hasError !== undefined) {
                const msgHasError = !!parsed.error;
                if (msgHasError !== hasError) return null;
              }

              return {
                offset: msg.offset,
                timestamp: msg.timestamp
                  ? new Date(parseInt(msg.timestamp)).toISOString()
                  : null,
                tracking_id:
                  parsed.tracking_id || parsed.metadata?.tracking_id || "N/A",
                has_error: !!parsed.error,
                error: parsed.error || null,
                stage: parsed.stage || parsed.metadata?.stage || "unknown",
                payload_preview:
                  JSON.stringify(parsed).substring(0, 200) + "...",
              };
            } catch (e) {
              return null;
            }
          })
          .filter((msg) => msg !== null)
          .slice(0, limit);

        const summary = {
          total_fetched: parsedMessages.length,
          with_errors: parsedMessages.filter((m) => m.has_error).length,
          without_errors: parsedMessages.filter((m) => !m.has_error).length,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary,
                  messages: parsedMessages,
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
              text: `Error querying processed messages: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 2: Search Lab Results
  // ===============================
  server.registerTool(
    "search_lab_results",
    {
      description:
        "Query lab_results table in openldr_external database. " +
        "Search by date range, result status, test type, or patient ID.",
      inputSchema: {
        start_date: z
          .string()
          .optional()
          .describe("Start date (ISO format: YYYY-MM-DD)"),
        end_date: z
          .string()
          .optional()
          .describe("End date (ISO format: YYYY-MM-DD)"),
        status: z
          .string()
          .optional()
          .describe(
            "Result status filter (e.g., 'completed', 'pending', 'cancelled')",
          ),
        test_type: z.string().optional().describe("Type of test to filter by"),
        patient_id: z.string().optional().describe("Patient ID to filter by"),
        limit: z
          .number()
          .default(20)
          .optional()
          .describe("Maximum number of results (default: 20, max: 100)"),
      },
      annotations: {
        title: "Search Lab Results",
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
        const limit = Math.min(params.limit || 20, 100);
        const conditions: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        // Build WHERE clause dynamically
        if (params.start_date) {
          conditions.push(`created_at >= $${paramIndex++}`);
          queryParams.push(params.start_date);
        }

        if (params.end_date) {
          conditions.push(`created_at <= $${paramIndex++}`);
          queryParams.push(params.end_date);
        }

        if (params.status) {
          conditions.push(`status = $${paramIndex++}`);
          queryParams.push(params.status);
        }

        if (params.test_type) {
          conditions.push(`test_type ILIKE $${paramIndex++}`);
          queryParams.push(`%${params.test_type}%`);
        }

        if (params.patient_id) {
          conditions.push(`patient_id = $${paramIndex++}`);
          queryParams.push(params.patient_id);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const query = `
        SELECT *
        FROM lab_results
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex}
      `;
        queryParams.push(limit);

        const result = await externalDb!.query(query, queryParams);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total_found: result.rowCount,
                  results: result.rows,
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
              text: `Error querying lab results: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 3: Trace Message Flow
  // ===============================
  server.registerTool(
    "trace_message_flow",
    {
      description:
        "Trace a message through the data pipeline using message_id or RequestID. " +
        "Shows presence in each Kafka topic (raw, mapped, validated, processed) and checks if data reached external database. " +
        "Note: One message may create multiple database records (patient, request, results).",
      inputSchema: {
        message_id: z
          .string()
          .optional()
          .describe("Message ID from MinIO upload"),
        request_id: z
          .string()
          .optional()
          .describe(
            "RequestID from the payload (exists in all database tables)",
          ),
        search_limit: z
          .number()
          .default(50)
          .optional()
          .describe(
            "Number of messages to search per topic (default: 50, max: 200)",
          ),
        skip_kafka: z
          .boolean()
          .default(false)
          .optional()
          .describe(
            "Skip Kafka search and only check database (faster, use if you have RequestID)",
          ),
      },
      annotations: {
        title: "Trace Message Flow",
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
        const messageId = params.message_id;
        const requestId = params.request_id;
        const skipKafka = params.skip_kafka;

        if (!messageId && !requestId) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Must provide either message_id or request_id",
              },
            ],
            isError: true,
          };
        }

        const searchLimit = Math.min(params.search_limit || 50, 200);
        const topics = [
          "raw-inbound",
          "mapped-inbound",
          "validated-inbound",
          "processed-inbound",
        ];

        const trace: any = {
          search_criteria: {
            message_id: messageId || null,
            request_id: requestId || null,
          },
          pipeline_stages: {},
          database_status: null,
          summary: {
            found_in_topics: [],
            missing_from_topics: [],
            has_errors: false,
            error_details: [],
            final_status: "unknown",
          },
        };

        let extractedRequestId = requestId;

        // Search Kafka topics in parallel (unless skipped)
        if (!skipKafka) {
          const topicSearchPromises = topics.map(async (topic) => {
            try {
              const messages = await kafkaManager!.fetchMessages(topic, {
                limit: searchLimit,
                fromBeginning: true,
                timeout: 4000, // 4 second timeout per topic
              });

              const found = messages.find((msg) => {
                try {
                  const value = msg.value?.toString();
                  if (!value) return false;
                  const parsed = JSON.parse(value);

                  // Search by message_id - check in multiple locations
                  if (messageId) {
                    const matchesMessageId =
                      // Direct fields
                      parsed.message_id === messageId ||
                      parsed.MessageID === messageId ||
                      parsed.messageid === messageId ||
                      // Metadata locations
                      parsed.metadata?.message_id === messageId ||
                      parsed.metadata?.MessageID === messageId ||
                      parsed.metadata?.messageid === messageId ||
                      // MinIO event structure
                      parsed.Records?.[0]?.s3?.object?.userMetadata?.[
                        "X-Amz-Meta-Messageid"
                      ] === messageId ||
                      // Key path (filename contains message_id)
                      parsed.Key?.includes(messageId) ||
                      parsed.Records?.[0]?.s3?.object?.key?.includes(messageId);

                    // Extract RequestID for database lookup from various locations
                    if (matchesMessageId && !extractedRequestId) {
                      extractedRequestId =
                        parsed.RequestID ||
                        parsed.request_id ||
                        parsed.payload?.RequestID ||
                        parsed.payload?.request_id ||
                        parsed.data?.RequestID ||
                        parsed.data?.request_id ||
                        // Check inside Records if it's a MinIO event
                        parsed.Records?.[0]?.RequestID ||
                        parsed.Records?.[0]?.request_id;
                    }

                    return matchesMessageId;
                  }

                  // Search by RequestID - check in multiple locations
                  if (requestId) {
                    return (
                      parsed.RequestID === requestId ||
                      parsed.request_id === requestId ||
                      parsed.payload?.RequestID === requestId ||
                      parsed.payload?.request_id === requestId ||
                      parsed.data?.RequestID === requestId ||
                      parsed.data?.request_id === requestId ||
                      parsed.Records?.[0]?.RequestID === requestId ||
                      parsed.Records?.[0]?.request_id === requestId
                    );
                  }

                  return false;
                } catch (e) {
                  return false;
                }
              });

              return { topic, found, messages };
            } catch (error: any) {
              return { topic, found: null, error: error.message };
            }
          });

          // Wait for all topic searches (max ~16 seconds total for 4 topics)
          const results = await Promise.all(topicSearchPromises);

          // Process results
          for (const result of results) {
            if (result.error) {
              trace.pipeline_stages[result.topic] = {
                found: false,
                error: `Failed to search topic: ${result.error}`,
              };
            } else if (result.found) {
              const value = result.found.value?.toString();
              const parsed = value ? JSON.parse(value) : {};

              trace.pipeline_stages[result.topic] = {
                found: true,
                timestamp: result.found.timestamp
                  ? new Date(parseInt(result.found.timestamp)).toISOString()
                  : null,
                offset: result.found.offset,
                has_error: !!parsed.error,
                error: parsed.error || null,
                stage: parsed.stage || result.topic,
                request_id: parsed.RequestID || parsed.request_id || null,
              };

              trace.summary.found_in_topics.push(result.topic);

              if (parsed.error) {
                trace.summary.has_errors = true;
                trace.summary.error_details.push({
                  stage: result.topic,
                  error: parsed.error,
                });
              }
            } else {
              trace.pipeline_stages[result.topic] = {
                found: false,
              };
              trace.summary.missing_from_topics.push(result.topic);
            }
          }
        } else {
          trace.pipeline_stages = {
            skipped: "Kafka search skipped (skip_kafka=true)",
          };
        }

        // Check database using RequestID
        if (extractedRequestId || requestId) {
          const lookupRequestId = extractedRequestId || requestId;

          try {
            // First, find lab_requests by request_id
            const requestsQuery = `
      SELECT 
        lr.lab_requests_id,
        lr.request_id,
        lr.facility_code,
        lr.facility_name,
        lr.patient_id,
        lr.panel_code,
        lr.panel_desc,
        lr.specimen_datetime,
        lr.created_at,
        lr.updated_at
      FROM lab_requests lr
      WHERE lr.request_id = $1
      LIMIT 1
    `;

            const requestsResult = await externalDb!.query(requestsQuery, [
              lookupRequestId,
            ]);

            let resultsData = null;

            // If request found, get associated lab_results
            if (requestsResult.rows.length > 0) {
              const labRequestsId = requestsResult.rows[0].lab_requests_id;

              const resultsQuery = `
        SELECT 
          lr.lab_results_id,
          lr.lab_requests_id,
          lr.obx_set_id,
          lr.observation_code,
          lr.observation_desc,
          lr.rpt_result,
          lr.rpt_units,
          lr.rpt_flag,
          lr.result_timestamp,
          lr.created_at,
          lr.updated_at
        FROM lab_results lr
        WHERE lr.lab_requests_id = $1
      `;

              const resultsResult = await externalDb!.query(resultsQuery, [
                labRequestsId,
              ]);

              resultsData = {
                found: true,
                count: resultsResult.rows.length,
                results: resultsResult.rows,
              };
            }

            const dbResults: any = {
              request_id: lookupRequestId,
              lab_requests: {
                found: requestsResult.rows.length > 0,
                record: requestsResult.rows[0] || null,
              },
              lab_results: resultsData || {
                found: false,
                count: 0,
                results: [],
              },
            };

            const foundInDb = requestsResult.rows.length > 0;

            trace.database_status = {
              checked: true,
              found: foundInDb,
              details: dbResults,
            };

            // Determine final status
            if (foundInDb) {
              trace.summary.final_status = "completed";
            } else if (trace.summary.has_errors) {
              trace.summary.final_status = "failed_with_errors";
            } else if (trace.summary.found_in_topics.includes("processed")) {
              trace.summary.final_status = "processed_but_not_in_db";
            } else if (trace.summary.found_in_topics.length > 0) {
              trace.summary.final_status = "in_progress";
            } else {
              trace.summary.final_status = "not_found";
            }
          } catch (error: any) {
            trace.database_status = {
              checked: true,
              found: false,
              error: `Failed to query database: ${error.message}`,
            };
          }
        } else {
          trace.database_status = {
            checked: false,
            reason: "No RequestID found in pipeline messages",
          };

          if (trace.summary.has_errors) {
            trace.summary.final_status = "failed_with_errors";
          } else if (trace.summary.found_in_topics.includes("processed")) {
            trace.summary.final_status = "reached_processed";
          } else if (trace.summary.found_in_topics.length > 0) {
            trace.summary.final_status = "in_progress";
          } else {
            trace.summary.final_status = "not_found";
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(trace, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error tracing message flow: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 4: Get MinIO Message
  // ===============================
  server.registerTool(
    "get_minio_message",
    {
      description:
        "Retrieve message content from MinIO bucket by bucket name and object key. " +
        "Useful for inspecting actual message payloads at different pipeline stages.",
      inputSchema: {
        bucket_name: z
          .string()
          .describe(
            "MinIO bucket name (e.g., '7123dde4-d53a-4f4e-a5f5-53d18d4f9481')",
          ),
        object_key: z
          .string()
          .describe("Object key/path (e.g., 'processed/xxx/message-id.json')"),
        include_metadata: z
          .boolean()
          .default(false)
          .optional()
          .describe(
            "Include object metadata (size, content-type, user metadata)",
          ),
      },
      annotations: {
        title: "Get MinIO Message",
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
        const bucketName = params.bucket_name;
        const objectKey = params.object_key;
        const includeMetadata = params.include_metadata || false;

        // Get object content
        const content = await getObjectContent(bucketName, objectKey);

        let result: any = {
          bucket: bucketName,
          key: objectKey,
          content: JSON.parse(content),
        };

        // Optionally include metadata
        if (includeMetadata) {
          const metadata = await getObjectMetadata(bucketName, objectKey);
          result.metadata = {
            size: metadata.size,
            etag: metadata.etag,
            lastModified: metadata.lastModified,
            contentType: metadata.metaData?.["content-type"],
            userMetadata: metadata.metaData,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving MinIO message: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 5: Check Kafka Consumer Lag
  // ===============================
  server.registerTool(
    "check_kafka_consumer_lag",
    {
      description:
        "Monitor Kafka consumer lag across all topics. " +
        "Shows number of messages waiting to be processed and identifies bottlenecks. " +
        "High lag indicates consumers are slow or stuck.",
      inputSchema: {
        topics: z
          .array(z.string())
          .optional()
          .describe("Specific topics to check (default: all inbound topics)"),
      },
      annotations: {
        title: "Check Kafka Consumer Lag",
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
        const defaultTopics = [
          "raw-inbound",
          "mapped-inbound",
          "validated-inbound",
          "processed-inbound",
        ];
        const topicsToCheck = params.topics || defaultTopics;

        const results: any = {
          checked_at: new Date().toISOString(),
          topics: {},
          summary: {
            total_topics: 0,
            topics_with_messages: 0,
            total_messages: 0,
            potential_issues: [],
          },
        };

        for (const topic of topicsToCheck) {
          try {
            const offsets = await kafkaManager!.getTopicOffsets(topic);

            let totalMessages = 0;
            const partitions = offsets.map((offset) => {
              const messageCount = parseInt(offset.high) - parseInt(offset.low);
              totalMessages += messageCount;

              return {
                partition: offset.partition,
                low: offset.low,
                high: offset.high,
                message_count: messageCount,
              };
            });

            results.topics[topic] = {
              found: true,
              partition_count: partitions.length,
              total_messages: totalMessages,
              partitions,
            };

            results.summary.total_topics++;
            if (totalMessages > 0) {
              results.summary.topics_with_messages++;
              results.summary.total_messages += totalMessages;
            }

            // Flag potential issues
            if (totalMessages > 1000) {
              results.summary.potential_issues.push({
                topic,
                issue: "high_message_count",
                message_count: totalMessages,
                recommendation:
                  "Consider checking if consumers are processing messages",
              });
            }
          } catch (error: any) {
            results.topics[topic] = {
              found: false,
              error: error.message,
            };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking Kafka consumer lag: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 6: Check Data Completion
  // ===============================
  server.registerTool(
    "check_data_completion",
    {
      description:
        "Reconcile processed Kafka messages against database records. " +
        "Identifies messages that reached 'processed' topic but failed to insert into database. " +
        "Useful for catching silent failures in the final database insertion step.",
      inputSchema: {
        time_window_minutes: z
          .number()
          .default(60)
          .optional()
          .describe("Check messages from last N minutes (default: 60)"),
        limit: z
          .number()
          .default(50)
          .optional()
          .describe("Maximum messages to check (default: 50, max: 200)"),
      },
      annotations: {
        title: "Check Data Completion",
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
        const timeWindowMinutes = params.time_window_minutes || 60;
        const limit = Math.min(params.limit || 50, 200);
        const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

        // Fetch recent processed messages
        const messages = await kafkaManager!.fetchMessages(
          "processed-inbound",
          {
            limit,
            fromBeginning: false,
            timeout: 5000,
          },
        );

        const results: any = {
          checked_at: new Date().toISOString(),
          time_window_minutes: timeWindowMinutes,
          total_checked: 0,
          found_in_database: 0,
          missing_from_database: 0,
          errors_in_processed: 0,
          missing_request_ids: [],
          details: [],
        };

        for (const msg of messages) {
          try {
            const value = msg.value?.toString();
            if (!value) continue;

            const parsed = JSON.parse(value);
            const msgTimestamp = msg.timestamp
              ? new Date(parseInt(msg.timestamp))
              : null;

            // Skip if outside time window
            if (msgTimestamp && msgTimestamp < startTime) continue;

            results.total_checked++;

            // Skip if message has error
            if (parsed.error) {
              results.errors_in_processed++;
              continue;
            }

            // Extract RequestID
            const requestId =
              parsed.RequestID ||
              parsed.request_id ||
              parsed.payload?.RequestID ||
              parsed.payload?.request_id ||
              parsed.data?.RequestID ||
              parsed.data?.request_id;

            if (!requestId) {
              results.missing_request_ids.push({
                offset: msg.offset,
                timestamp: msgTimestamp?.toISOString(),
                message_preview:
                  JSON.stringify(parsed).substring(0, 100) + "...",
              });
              continue;
            }

            // Check if exists in database
            const dbQuery = `
            SELECT lab_requests_id, request_id, created_at
            FROM lab_requests
            WHERE request_id = $1
            LIMIT 1
          `;

            const dbResult = await externalDb!.query(dbQuery, [requestId]);

            if (dbResult.rows.length > 0) {
              results.found_in_database++;
            } else {
              results.missing_from_database++;
              results.details.push({
                request_id: requestId,
                kafka_offset: msg.offset,
                kafka_timestamp: msgTimestamp?.toISOString(),
                status: "missing_from_database",
              });
            }
          } catch (error: any) {
            // Skip malformed messages
            continue;
          }
        }

        // Calculate completion rate
        const totalValid =
          results.total_checked -
          results.errors_in_processed -
          results.missing_request_ids.length;
        results.completion_rate =
          totalValid > 0
            ? ((results.found_in_database / totalValid) * 100).toFixed(2) + "%"
            : "N/A";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking data completion: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 7: Search Lab Requests
  // ===============================
  server.registerTool(
    "search_lab_requests",
    {
      description:
        "Query lab_requests table in openldr_external database. " +
        "Search by request_id, facility, date range, panel code, or patient ID.",
      inputSchema: {
        request_id: z
          .string()
          .optional()
          .describe("Specific request ID to find"),
        facility_code: z.string().optional().describe("Facility code filter"),
        patient_id: z.string().optional().describe("Patient ID filter"),
        panel_code: z.string().optional().describe("Panel/test code filter"),
        start_date: z
          .string()
          .optional()
          .describe(
            "Start date for specimen collection (ISO format: YYYY-MM-DD)",
          ),
        end_date: z
          .string()
          .optional()
          .describe(
            "End date for specimen collection (ISO format: YYYY-MM-DD)",
          ),
        limit: z
          .number()
          .default(20)
          .optional()
          .describe("Maximum number of results (default: 20, max: 100)"),
      },
      annotations: {
        title: "Search Lab Requests",
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
        const limit = Math.min(params.limit || 20, 100);
        const conditions: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        // Build WHERE clause dynamically
        if (params.request_id) {
          conditions.push(`request_id = $${paramIndex++}`);
          queryParams.push(params.request_id);
        }

        if (params.facility_code) {
          conditions.push(`facility_code = $${paramIndex++}`);
          queryParams.push(params.facility_code);
        }

        if (params.patient_id) {
          conditions.push(`patient_id = $${paramIndex++}`);
          queryParams.push(params.patient_id);
        }

        if (params.panel_code) {
          conditions.push(`panel_code ILIKE $${paramIndex++}`);
          queryParams.push(`%${params.panel_code}%`);
        }

        if (params.start_date) {
          conditions.push(`specimen_datetime >= $${paramIndex++}`);
          queryParams.push(params.start_date);
        }

        if (params.end_date) {
          conditions.push(`specimen_datetime <= $${paramIndex++}`);
          queryParams.push(params.end_date);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const query = `
        SELECT 
          lab_requests_id,
          request_id,
          facility_code,
          facility_name,
          patient_id,
          obr_set_id,
          panel_code,
          panel_desc,
          specimen_datetime,
          created_at,
          updated_at
        FROM lab_requests
        ${whereClause}
        ORDER BY specimen_datetime DESC NULLS LAST, created_at DESC
        LIMIT $${paramIndex}
      `;
        queryParams.push(limit);

        const result = await externalDb!.query(query, queryParams);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total_found: result.rowCount,
                  requests: result.rows,
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
              text: `Error querying lab requests: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 8: Get Recent Pipeline Errors
  // ===============================
  server.registerTool(
    "get_recent_pipeline_errors",
    {
      description:
        "Retrieve recent errors from the processed topic and analyze error patterns. " +
        "Shows error types, frequencies, and affected stages to help identify systematic issues.",
      inputSchema: {
        limit: z
          .number()
          .default(50)
          .optional()
          .describe(
            "Maximum number of error messages to retrieve (default: 50, max: 200)",
          ),
        group_by_error_type: z
          .boolean()
          .default(true)
          .optional()
          .describe("Group errors by type and show counts (default: true)"),
      },
      annotations: {
        title: "Get Recent Pipeline Errors",
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
        const limit = Math.min(params.limit || 50, 200);
        const groupByType = params.group_by_error_type !== false;

        // Fetch messages from processed topic
        const messages = await kafkaManager!.fetchMessages(
          "processed-inbound",
          {
            limit: limit * 2, // Fetch more since we'll filter
            fromBeginning: false,
            timeout: 5000,
          },
        );

        const errors: any[] = [];
        const errorGroups: { [key: string]: number } = {};
        const stageErrors: { [key: string]: number } = {};

        for (const msg of messages) {
          try {
            const value = msg.value?.toString();
            if (!value) continue;

            const parsed = JSON.parse(value);

            // Only process messages with errors
            if (!parsed.error) continue;

            const errorInfo = {
              timestamp: msg.timestamp
                ? new Date(parseInt(msg.timestamp)).toISOString()
                : null,
              offset: msg.offset,
              request_id: parsed.RequestID || parsed.request_id || "N/A",
              stage: parsed.stage || parsed.metadata?.stage || "unknown",
              error: parsed.error,
            };

            errors.push(errorInfo);

            // Group by error type/message
            if (groupByType) {
              const errorKey =
                typeof parsed.error === "string"
                  ? parsed.error
                  : parsed.error?.message ||
                    parsed.error?.code ||
                    "Unknown error";

              errorGroups[errorKey] = (errorGroups[errorKey] || 0) + 1;

              const stage = errorInfo.stage;
              stageErrors[stage] = (stageErrors[stage] || 0) + 1;
            }

            if (errors.length >= limit) break;
          } catch (e) {
            continue;
          }
        }

        const result: any = {
          checked_at: new Date().toISOString(),
          total_errors: errors.length,
          errors: errors.slice(0, limit),
        };

        if (groupByType) {
          // Sort by frequency
          const sortedErrorTypes = Object.entries(errorGroups)
            .sort(([, a], [, b]) => b - a)
            .map(([error, count]) => ({ error, count }));

          const sortedStageErrors = Object.entries(stageErrors)
            .sort(([, a], [, b]) => b - a)
            .map(([stage, count]) => ({ stage, count }));

          result.error_summary = {
            by_error_type: sortedErrorTypes,
            by_stage: sortedStageErrors,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving pipeline errors: ${error.message}\n${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ===============================
  // TOOL 9: Get Service Logs
  // ===============================
  server.registerTool(
    "get_service_logs",
    {
      description:
        "Retrieve recent logs from Node.js consumers or other services. " +
        "Note: Currently returns info about log access since containers log to stdout. " +
        "In production, integrate with your logging system (Loki, CloudWatch, etc.)",
      inputSchema: {
        service_name: z
          .string()
          .describe(
            "Service name (e.g., 'raw-consumer', 'mapped-consumer', 'validated-consumer')",
          ),
        lines: z
          .number()
          .default(100)
          .optional()
          .describe("Number of log lines to retrieve (default: 100)"),
      },
      annotations: {
        title: "Get Service Logs",
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

      // This is a placeholder - integrate with actual logging system
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                note: "Log retrieval not yet implemented",
                service: params.service_name,
                recommendation:
                  "Currently services log to stdout. Options:\n" +
                  "1. Use 'docker logs <container-name>' for development\n" +
                  "2. Integrate with centralized logging (Loki, CloudWatch, Elasticsearch)\n" +
                  "3. Add log persistence to MCP server for remote access",
                requested_lines: params.lines,
              },
              null,
              2,
            ),
          },
        ],
      };
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
