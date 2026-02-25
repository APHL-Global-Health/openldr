import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import * as facilityService from "../../services/facility.service";
import { logger } from "../../lib/logger";
import vm from "vm";
import https from "https";
import http from "http";

// Security Level Execution Methods
async function executeHighSecurityPlugin(
  pluginFile: any,
  messageContent: any,
  pluginId: any,
) {
  // Helper function for HTTP requests (runs in parent context)
  async function makeHttpRequest(
    method: any,
    url: any,
    data = null,
    headers = {},
  ) {
    // Basic URL validation
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error(`Invalid protocol: ${urlObj.protocol}`);
    }

    return new Promise((resolve, reject) => {
      const protocol = urlObj.protocol === "https:" ? https : http;
      const options = {
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      const req = protocol.request(url, options, (res: any) => {
        let responseData = "";
        res.on("data", (chunk: any) => (responseData += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: responseData,
            ok: res.statusCode >= 200 && res.statusCode < 300,
          });
        });
      });

      req.on("error", reject);
      req.setTimeout(10000, () => req.destroy());

      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  // Method 3: Secure approach (runInNewContext)
  const wrappedScript = `
    (function() {
      var module = { exports: {} };
      var exports = module.exports;
      
      ${pluginFile}
      
      return module.exports;
    })();
  `;

  // Create restricted context with simple HTTP bridge
  const context = {
    console: {
      log: (...args: any) => logger.info(`[PLUGIN-${pluginId}]`, ...args),
      error: (...args: any) => logger.error(`[PLUGIN-${pluginId}]`, ...args),
      warn: (...args: any) => logger.warn(`[PLUGIN-${pluginId}]`, ...args),
    },
    // Safe built-ins
    JSON: JSON,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    Math: Math,
    RegExp: RegExp,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    // Simple HTTP bridge - plugin requests HTTP calls from parent context
    http: {
      request: async function (
        method: any,
        url: any,
        data = null,
        headers = {},
      ) {
        // This function will be called by the plugin
        // We'll handle the actual HTTP request in the parent context
        return await makeHttpRequest(method, url, data, headers);
      },
    },
  };

  try {
    const script = new vm.Script(wrappedScript);
    const pluginFunctions = script.runInNewContext(context, {
      timeout: 10000,
      displayErrors: true,
    });

    // Validate plugin exports
    if (typeof pluginFunctions.process !== "function") {
      throw new Error("Recipient plugin must export a process function");
    }

    // Execute processing
    const response = await pluginFunctions.process(messageContent);
    return response;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `High security plugin execution failed (ID: ${pluginId})`,
    );
    throw new Error(`Plugin execution failed: ${error.message}`);
  }
}

async function executeMediumSecurityPlugin(
  pluginFile: any,
  messageContent: any,
  pluginId: any,
) {
  // Method 2: Enhanced approach (runInThisContext with safety)
  const wrappedScript = `
    (function() {
      // Shadow dangerous globals
      var process = undefined;
      var global = undefined;
      var GLOBAL = undefined;
      var root = undefined;
      var require = undefined;
      
      var module = { exports: {} };
      var exports = module.exports;
      
      ${pluginFile}
      
      // Validate plugin structure
      if (typeof module.exports !== 'object' || 
          typeof module.exports.process !== 'function') {
        throw new Error('Recipient plugin must export a process function');
      }
      
      return module.exports;
    })();
  `;

  try {
    const script = new vm.Script(wrappedScript, {
      filename: `plugin-${pluginId}.js`,
      // displayErrors: true,
    });

    const pluginFunctions = script.runInThisContext({
      timeout: 10000,
      displayErrors: true,
      breakOnSigint: true,
    });

    // Execute processing with timeout
    const processingPromise = Promise.resolve(
      pluginFunctions.process(messageContent),
    );
    const processedMessage = await Promise.race([
      processingPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Plugin processing timeout")), 5000),
      ),
    ]);

    return processedMessage;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Medium security plugin execution failed (ID: ${pluginId})`,
    );
    throw new Error(`Plugin execution failed: ${error.message}`);
  }
}

async function executeLowSecurityPlugin(
  pluginFile: any,
  messageContent: any,
  pluginId: any,
) {
  // Method 1: Current approach (runInThisContext)
  const wrappedScript = `
    (function() {
      var module = { exports: {} };
      ${pluginFile}
      return module.exports;
    })();
  `;

  try {
    const script = new vm.Script(wrappedScript);
    const pluginFunctions = script.runInThisContext({});

    // Validate plugin exports
    if (typeof pluginFunctions.process !== "function") {
      throw new Error("Recipient plugin must export a process function");
    }

    // Execute processing
    return await pluginFunctions.process(messageContent);
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Low security plugin execution failed (ID: ${pluginId})`,
    );
    throw new Error(`Plugin execution failed: ${error.message}`);
  }
}

async function enrichMessageWithMetadata(
  messageContent: any,
  facilityId: any,
  dataFeed: any,
  kafkaMessage: any,
  _plugin: any,
) {
  // Get facility information
  const facility = await facilityService.getFacilityById(facilityId);

  // Extract metadata from the Kafka message
  const kafkaValue = JSON.parse(kafkaMessage.value);
  const userMetadata = kafkaValue.Records[0].s3.object.userMetadata;

  const data_feed: any = {
    data_feed_id: dataFeed.dataFeedId,
    data_feed_name: dataFeed.dataFeedName,
    data_feed_description: dataFeed.description,
    schema_plugin: null,
    mapper_plugin: null,
    recipient_plugin: null,
  };
  if (dataFeed.schemaPlugin?.pluginId) {
    data_feed["schema_plugin"] = {
      plugin_id: dataFeed.schemaPlugin.pluginId,
      plugin_name: dataFeed.schemaPlugin.pluginName,
      plugin_version: dataFeed.schemaPlugin.pluginVersion,
      plugin_type: dataFeed.schemaPlugin.pluginType,
      security_level: dataFeed.schemaPlugin.securityLevel,
      plugin_minio_object_path: dataFeed.schemaPlugin.pluginMinioObjectPath,
    };
  }
  if (dataFeed.mapperPlugin?.pluginId) {
    data_feed["mapper_plugin"] = {
      plugin_id: dataFeed.mapperPlugin.pluginId,
      plugin_name: dataFeed.mapperPlugin.pluginName,
      plugin_version: dataFeed.mapperPlugin.pluginVersion,
      plugin_type: dataFeed.mapperPlugin.pluginType,
      security_level: dataFeed.mapperPlugin.securityLevel,
      plugin_minio_object_path: dataFeed.mapperPlugin.pluginMinioObjectPath,
    };
  }
  if (dataFeed.recipientPlugin?.pluginId) {
    data_feed["recipient_plugin"] = {
      plugin_id: dataFeed.recipientPlugin.pluginId,
      plugin_name: dataFeed.recipientPlugin.pluginName,
      plugin_version: dataFeed.recipientPlugin.pluginVersion,
      plugin_type: dataFeed.recipientPlugin.pluginType,
      security_level: dataFeed.recipientPlugin.securityLevel,
      plugin_minio_object_path: dataFeed.recipientPlugin.pluginMinioObjectPath,
    };
  }

  // Create metadata object
  const metadata = {
    timestamp: new Date().toISOString(),
    environment: process.env.HOST_ENVIRONMENT,
    host_ip: process.env.HOST_IP,
    project: userMetadata["X-Amz-Meta-Project"] || null,
    use_case: userMetadata["X-Amz-Meta-Usecase"] || null,
    facility: {
      facility_id: facilityId,
      facility_name: facility?.facilityName || null,
      facility_code: facility?.facilityCode || null,
      facility_type: facility?.facilityType || null,
      description: facility?.description || null,
      country_code: facility?.countryCode || null,
      province_code: facility?.provinceCode || null,
      region_code: facility?.regionCode || null,
      district_code: facility?.districtCode || null,
      sub_district_code: facility?.subDistrictCode || null,
      latitude: facility?.latitude || null,
      longitude: facility?.longitude || null,
    },
    data_feed,
    message: {
      message_id: userMetadata["X-Amz-Meta-Messageid"] || null,
      message_datetime: userMetadata["X-Amz-Meta-Messagedatetime"] || null,
      user_id: userMetadata["X-Amz-Meta-Userid"] || null,
      filename: userMetadata["X-Amz-Meta-Filename"] || null,
    },
  };

  // Add metadata to message content (similar to _mappings)
  const enrichedMessage = {
    ...messageContent,
    _metadata: metadata,
  };

  return enrichedMessage;
}

async function handleMessage(kafkaMessage: any) {
  try {
    // Parse the Kafka message value
    const kafkaValue = JSON.parse(kafkaMessage.value);

    // Extract the key and parse it
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split("/");
    const mapperName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (!projectId || !dataFeedId) {
      throw new Error(`Invalid message key format: ${key}`);
    }

    // Get the data feed to retrieve the recipient plugin ID
    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw new Error(`Data feed with ID ${dataFeedId} not found`);
    }

    // Get the object from MinIO using the full key path
    const objectStream = await minioUtil.getObject({
      bucketName: projectId,
      objectName: mapperName,
    });

    // Read the object data
    let objectData = "";
    await new Promise((resolve, reject) => {
      objectStream.on("data", (chunk) => {
        objectData += chunk.toString();
      });
      objectStream.on("end", resolve);
      objectStream.on("error", (err) =>
        reject(new Error(`Failed to read object stream: ${err.message}`)),
      );
    });

    // Parse the message content
    const messageContent = JSON.parse(objectData);

    // Default processed message to original message
    let processedMessage = messageContent;

    // If data feed has a recipient plugin configured, use it for processing
    if (dataFeed.recipientPluginId) {
      // Get the recipient plugin to use for processing
      const plugin = await pluginService.getPluginById({
        pluginID: dataFeed.recipientPluginId,
      });
      if (!plugin) {
        throw new Error(
          `Plugin with ID ${dataFeed.recipientPluginId} not found`,
        );
      }

      // Enrich message with metadata before passing to plugin
      const enrichedMessage = await enrichMessageWithMetadata(
        messageContent,
        dataFeed.facilityId,
        dataFeed,
        kafkaMessage,
        plugin,
      );

      // Update processedMessage to enriched message
      processedMessage = enrichedMessage;

      // Get the plugin file from MinIO
      const pluginStream = await minioUtil.getObject({
        bucketName: "plugins",
        objectName: plugin.pluginMinioObjectPath,
      });

      // Read the plugin file
      let pluginFile = "";
      await new Promise((resolve, reject) => {
        pluginStream.on("data", (chunk) => {
          pluginFile += chunk.toString();
        });
        pluginStream.on("end", resolve);
        pluginStream.on("error", (err) =>
          reject(
            new Error(
              `Failed to read plugin file object stream: ${err.message}`,
            ),
          ),
        );
      });

      // Execute based on plugin's security level
      try {
        let pluginResult;

        switch (plugin.securityLevel) {
          case "high":
            pluginResult = await executeHighSecurityPlugin(
              pluginFile,
              enrichedMessage,
              plugin.pluginId,
            );
            break;

          case "medium":
            pluginResult = await executeMediumSecurityPlugin(
              pluginFile,
              enrichedMessage,
              plugin.pluginId,
            );
            break;

          case "low":
            pluginResult = await executeLowSecurityPlugin(
              pluginFile,
              enrichedMessage,
              plugin.pluginId,
            );
            break;

          default:
            throw new Error(
              `Invalid security level: ${plugin.securityLevel} for plugin ${plugin.pluginId}`,
            );
        }

        // Add processing results to the final message
        if (pluginResult) {
          processedMessage = {
            ...processedMessage, // enriched message with _metadata
            _processing_results: pluginResult, // add processing results
          };
        } else {
          // Plugin returned null/undefined, add empty processing results
          processedMessage = {
            ...processedMessage, // enriched message with _metadata
            _processing_results: {
              success: false,
              processed: { patients: 0, requests: 0, results: 0 },
              errors: ["Plugin returned null/undefined"],
              record_ids: { patients: [], requests: [], results: [] },
              processing_completed: new Date().toISOString(),
            },
          };
          logger.info(
            `Plugin ${dataFeed.recipientPluginId} returned null/undefined, added empty processing results`,
          );
        }
      } catch (pluginError: any) {
        logger.error(
          pluginError.message,
          `Plugin execution error for plugin ${dataFeed.recipientPluginId} (${plugin.securityLevel} security)`,
        );
        // Add error information to processing results
        processedMessage = {
          ...processedMessage, // enriched message with _metadata
          _processing_results: {
            success: false,
            processed: { patients: 0, requests: 0, results: 0 },
            errors: [pluginError.message],
            record_ids: { patients: [], requests: [], results: [] },
            processing_completed: new Date().toISOString(),
          },
        };
      }
    } else {
      // No recipient plugin configured, enrich with metadata and add empty processing results
      const enrichedMessage = await enrichMessageWithMetadata(
        messageContent,
        dataFeed.facilityId,
        dataFeed,
        kafkaMessage,
        null,
      );
      processedMessage = {
        ...enrichedMessage, // enriched message with _metadata
        _processing_results: {
          success: true,
          processed: { patients: 0, requests: 0, results: 0 },
          errors: [],
          record_ids: { patients: [], requests: [], results: [] },
          processing_completed: new Date().toISOString(),
          notes: [
            "No recipient plugin configured for this data feed - message enriched with metadata only",
          ],
        },
      };
    }

    // get message size
    const bodyData = JSON.stringify(processedMessage, null, 2);
    const size = Buffer.byteLength(bodyData); // Calculate size directly from the string

    // Extract metadata from the Kafka message
    const userMetadata = kafkaValue.Records[0].s3.object.userMetadata;
    const messageId = userMetadata["X-Amz-Meta-Messageid"];
    const messageDateTime = userMetadata["X-Amz-Meta-Messagedatetime"];
    const userId = userMetadata["X-Amz-Meta-Userid"];

    // create standard message metadata from internalDB schema
    const messageMetadata = utils.generateMessageMetadata({
      dataFeed: dataFeed,
      size: size,
      messageId: messageId,
      messageDateTime: messageDateTime,
      userId: userId,
      status: "processed",
      messageContentType: "application/json", // Processed messages are always JSON
      fileFormat: ".json", // Specify JSON extension for processed messages
    });

    // Save the message data to minio with metadata
    await minioUtil.putObject({
      bucketName: projectId,
      objectName: messageMetadata.FileName,
      data: bodyData,
      messageMetadata: messageMetadata,
    });
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Error processing message",
    );
    throw error;
  }
}

export { handleMessage };
