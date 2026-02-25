import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import { logger } from "../../lib/logger";

async function handleMessage(kafkaMessage: any) {
  try {
    // Parse the Kafka message value
    const kafkaValue = JSON.parse(kafkaMessage.value);

    // Extract the key and parse it
    const key = kafkaMessage.key;
    const [facilityId, dataKey, dataFeedId, objectName] = key.split("/");
    const validatedName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (!facilityId || !dataFeedId) {
      throw new Error(`Invalid message key format: ${key}`);
    }

    // Get the data feed to retrieve the mapper plugin ID
    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw new Error(`Data feed with ID ${dataFeedId} not found`);
    }

    // Get the object from MinIO using the full key path
    const objectStream = await minioUtil.getObject({
      bucketName: facilityId,
      objectName: validatedName,
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

    // default processed message to original message
    let processedMessage = messageContent;

    // if data feed has a mapper plugin configured, use it for transformation
    if (dataFeed.mapperPluginId) {
      // Get the mapper plugin to use for transformation
      const plugin = await pluginService.getPluginById({
        pluginID: dataFeed.mapperPluginId,
      });
      if (!plugin) {
        logger.error(
          `Plugin with ID ${dataFeed.mapperPluginId} not found, continuing with original message`,
        );
      } else {
        try {
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

          // Parse the terminology mapping configuration
          let mappingConfig;
          try {
            mappingConfig = JSON.parse(pluginFile);
          } catch (parseError: any) {
            logger.error(
              `Failed to parse mapping configuration for plugin ${dataFeed.mapperPluginId}: ${parseError.message}, continuing with original message`,
            );
          }

          // Apply terminology mappings to the message
          if (mappingConfig) {
            try {
              processedMessage = applyTerminologyMappings(
                messageContent,
                mappingConfig,
              );
              logger.info(
                `Successfully applied terminology mappings for plugin ${dataFeed.mapperPluginId}`,
              );
            } catch (mappingError: any) {
              logger.error(
                `Message mapping failed for plugin ${dataFeed.mapperPluginId}: ${mappingError.message}, continuing with original message`,
              );
            }
          }
        } catch (pluginError: any) {
          logger.error(
            `Plugin processing error for plugin ${dataFeed.mapperPluginId}: ${pluginError.message}, continuing with original message`,
          );
        }
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
      status: "mapped",
      messageContentType: "application/json", // Processed messages are always JSON
      fileFormat: ".json", // Specify JSON extension for mapped messages
    });

    // Save the processed message to minio with metadata
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

/**
 * Applies terminology mappings to a message using the mapping configuration
 * @param {Object} message - The message to apply mappings to
 * @param {Object} mappingConfig - The terminology mapping configuration
 * @returns {Object} - The message with _mappings object added
 */
function applyTerminologyMappings(message: any, mappingConfig: any) {
  const processedMessage = JSON.parse(JSON.stringify(message)); // Deep clone

  if (!mappingConfig.concepts) {
    return processedMessage;
  }

  // Find all concept keys present in the message
  const foundConcepts = new Set();
  scanForConcepts(processedMessage, mappingConfig.concepts, foundConcepts);

  // Add _mappings object with all found concepts
  if (foundConcepts.size > 0) {
    processedMessage._mappings = {};

    foundConcepts.forEach((conceptKey: any) => {
      const conceptData = mappingConfig.concepts[conceptKey];
      processedMessage._mappings[conceptKey] = {
        concept: conceptData.concept,
        mappings: conceptData.mappings || [],
      };
    });
  }

  return processedMessage;
}

/**
 * Recursively scans an object for concept keys that exist in the mapping configuration
 * @param {any} obj - The object to scan
 * @param {Object} concepts - The concepts from mapping configuration
 * @param {Set} foundConcepts - Set to collect found concept keys
 */
function scanForConcepts(obj: any, concepts: any, foundConcepts: any) {
  if (typeof obj === "string") {
    // Check if this string value is a concept key in our mapping
    if (concepts[obj]) {
      foundConcepts.add(obj);
    }
  } else if (Array.isArray(obj)) {
    // Recursively scan array elements
    obj.forEach((item) => scanForConcepts(item, concepts, foundConcepts));
  } else if (obj && typeof obj === "object") {
    // Recursively scan object properties
    Object.values(obj).forEach((value) =>
      scanForConcepts(value, concepts, foundConcepts),
    );
  }
}

export { handleMessage };
