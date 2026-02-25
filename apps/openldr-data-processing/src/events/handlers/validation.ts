import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import vm from "vm";
import https from "https";
import http from "http";
import { logger } from "../../lib/logger";

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
    if (
      typeof pluginFunctions.validate !== "function" ||
      typeof pluginFunctions.convert !== "function"
    ) {
      throw new Error("Plugin must export validate and convert functions");
    }

    // Execute validation and conversion
    const validationResult = await pluginFunctions.validate(messageContent);
    if (validationResult) {
      return await pluginFunctions.convert(messageContent);
    }
    return null;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `High security plugin execution failed (ID: ${pluginId}):`,
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
          typeof module.exports.validate !== 'function' || 
          typeof module.exports.convert !== 'function') {
        throw new Error('Plugin must export validate and convert functions');
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

    // Execute validation with timeout
    const validationPromise = Promise.resolve(
      pluginFunctions.validate(messageContent),
    );
    const validationResult = await Promise.race([
      validationPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Plugin validation timeout")), 5000),
      ),
    ]);

    if (!validationResult) {
      return null;
    }

    // Execute conversion with timeout
    const conversionPromise = Promise.resolve(
      pluginFunctions.convert(messageContent),
    );
    const convertedMessage = await Promise.race([
      conversionPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Plugin conversion timeout")), 5000),
      ),
    ]);

    return convertedMessage;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Medium security plugin execution failed (ID: ${pluginId}):`,
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
    if (
      typeof pluginFunctions.validate !== "function" ||
      typeof pluginFunctions.convert !== "function"
    ) {
      throw new Error("Plugin must export validate and convert functions");
    }

    // Execute validation and conversion
    const validationResult = await pluginFunctions.validate(messageContent);
    if (validationResult) {
      return await pluginFunctions.convert(messageContent);
    }
    return null;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Low security plugin execution failed (ID: ${pluginId}):`,
    );
    throw new Error(`Plugin execution failed: ${error.message}`);
  }
}

async function handleMessage(kafkaMessage: any) {
  try {
    // Parse the Kafka message value
    const kafkaValue = JSON.parse(kafkaMessage.value);

    // Extract the key and parse it
    const key = kafkaMessage.key;
    const [facilityId, dataKey, dataFeedId, objecName] = key.split("/");
    const rawName = `${dataKey}/${dataFeedId}/${objecName}`;

    if (!facilityId || !dataFeedId) {
      throw new Error(`Invalid message key format: ${key}`);
    }

    // Get the data feed to retrieve the schema plugin ID
    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw new Error(`Data feed with ID ${dataFeedId} not found`);
    }

    // Get object metadata to determine content type
    const objectStat = await minioUtil.statObject({
      bucketName: facilityId,
      objectName: rawName,
    });

    // Extract contentType from metadata
    const contentType =
      objectStat.metaData["x-amz-meta-contenttype"] ||
      "application/octet-stream";

    // Get the message object from MinIO using the full key path that aligns to the facility bucket, data key, data feed, and name
    const messageStream = await minioUtil.getObject({
      bucketName: facilityId,
      objectName: rawName,
    });

    // Read the message data
    let messageData = "";
    await new Promise((resolve, reject) => {
      messageStream.on("data", (chunk: any) => {
        messageData += chunk.toString();
      });
      messageStream.on("end", resolve);
      messageStream.on("error", (err: any) =>
        reject(
          new Error(`Failed to read message object stream: ${err.message}`),
        ),
      );
    });

    // Parse the message content based on content type
    let messageContent;
    try {
      if (
        contentType === "application/json" ||
        contentType === "application/fhir+json"
      ) {
        messageContent = JSON.parse(messageData);
      } else if (contentType === "application/hl7-v2") {
        messageContent = messageData; // HL7 messages should be passed as strings
      } else if (
        contentType === "application/xml" ||
        contentType === "application/fhir+xml" ||
        contentType === "text/xml"
      ) {
        messageContent = messageData; // XML messages as strings
      } else if (contentType === "text/csv" || contentType === "text/plain") {
        messageContent = messageData; // Text-based formats as strings
      } else {
        // For other content types, try JSON first, fallback to string
        try {
          messageContent = JSON.parse(messageData);
        } catch (jsonError) {
          messageContent = messageData;
        }
      }
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse message content (${contentType}): ${parseError.message}`,
      );
    }

    // default processed message to original message
    let processedMessage = messageContent;

    // if data feed has a schema plugin configured, use it for validation
    if (dataFeed.schemaPluginId) {
      // Get the schema plugin to use for validation
      const plugin = await pluginService.getPluginById({
        pluginID: dataFeed.schemaPluginId,
      });
      if (!plugin) {
        throw new Error(`Plugin with ID ${dataFeed.schemaPluginId} not found`);
      }

      // Get the plugin file from MinIO
      const pluginStream = await minioUtil.getObject({
        bucketName: "plugins",
        objectName: plugin.pluginMinioObjectPath,
      });

      // Read the plugin file
      let pluginFile = "";
      await new Promise((resolve, reject) => {
        pluginStream.on("data", (chunk: any) => {
          pluginFile += chunk.toString();
        });
        pluginStream.on("end", resolve);
        pluginStream.on("error", (err: any) =>
          reject(
            new Error(
              `Failed to read plugin file object stream: ${err.message}`,
            ),
          ),
        );
      });

      // Execute based on plugin's security level
      try {
        let result;

        switch (plugin.securityLevel) {
          case "high":
            result = await executeHighSecurityPlugin(
              pluginFile,
              messageContent,
              plugin.pluginId,
            );
            break;

          case "medium":
            result = await executeMediumSecurityPlugin(
              pluginFile,
              messageContent,
              plugin.pluginId,
            );
            break;

          case "low":
            result = await executeLowSecurityPlugin(
              pluginFile,
              messageContent,
              plugin.pluginId,
            );
            break;

          default:
            throw new Error(
              `Invalid security level: ${plugin.securityLevel} for plugin ${plugin.pluginId}`,
            );
        }

        if (result) {
          processedMessage = result;
        } else {
          logger.info(
            `Message validation failed for plugin ${dataFeed.schemaPluginId} (${plugin.securityLevel} security), skipping conversion`,
          );
          return; // Exit early for invalid messages
        }
      } catch (pluginError: any) {
        logger.error(
          pluginError.message,
          `Plugin execution error for plugin ${dataFeed.schemaPluginId} (${plugin.securityLevel} security)`,
        );
        return; // Exit early on plugin errors
      }
    }

    // get message size
    const bodyData = JSON.stringify(processedMessage, null, 2);
    const size = Buffer.byteLength(bodyData);

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
      status: "validated",
      messageContentType: "application/json", // Processed messages are always JSON
      fileFormat: ".json", // Specify JSON extension for validated messages
    });

    // Save the validated and converted message to minio with metadata
    await minioUtil.putObject({
      bucketName: facilityId,
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
