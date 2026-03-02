import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import * as terminologyService from "../../services/terminology.service";
import { logger } from "../../lib/logger";

async function handleMessage(kafkaMessage: any) {
  try {
    // Parse the Kafka message value
    const kafkaValue = JSON.parse(kafkaMessage.value);

    // Extract the key and parse it
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split("/");
    const validatedName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (!projectId || !dataFeedId) {
      throw new Error(`Invalid message key format: ${key}`);
    }

    // Get the data feed to retrieve the mapper plugin ID
    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw new Error(`Data feed with ID ${dataFeedId} not found`);
    }

    // Get the object from MinIO using the full key path
    const objectStream = await minioUtil.getObject({
      bucketName: projectId,
      objectName: validatedName,
    });

    // Read the object data
    let objectData = "";
    await new Promise((resolve, reject) => {
      objectStream.on("data", (chunk: any) => {
        objectData += chunk.toString();
      });
      objectStream.on("end", resolve);
      objectStream.on("error", (err: any) =>
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
          let mappingConfig: any = null;

          if (
            plugin.config?.fieldMappings &&
            Array.isArray(plugin.config.fieldMappings) &&
            plugin.config.fieldMappings.length > 0
          ) {
            // Primary path: explicit field-to-system mappings.
            // Supports multi-system data feeds (e.g. WHONET splits into
            // WHONET_ORG, WHONET_ABX, WHONET_SPEC) as well as mixed feeds
            // (LOINC + ICD10).  All systems are fetched in one DB round-trip.
            const systemCodes: string[] = [
              ...new Set<string>(
                plugin.config.fieldMappings
                  .map((fm: any) => fm.systemCode as string)
                  .filter(Boolean),
              ),
            ];
            const result =
              await terminologyService.getConceptsBySystemCodes(systemCodes);
            if (Object.keys(result.bySystem).length > 0) {
              mappingConfig = {
                bySystem: result.bySystem,
                fieldMappings: plugin.config.fieldMappings,
              };
            } else {
              logger.warn(
                `No concepts found for systems [${systemCodes.join(", ")}] ` +
                  `(plugin ${dataFeed.mapperPluginId}), continuing with original message`,
              );
            }
          } else if (plugin.config?.systemCode) {
            // Legacy path: single system code, uses string-value scanning.
            const result = await terminologyService.getConceptsBySystem(
              plugin.config.systemCode,
            );
            if (Object.keys(result.concepts).length > 0) {
              mappingConfig = result;
            } else {
              logger.warn(
                `No concepts found for systemCode '${plugin.config.systemCode}' ` +
                  `(plugin ${dataFeed.mapperPluginId}), continuing with original message`,
              );
            }
          } else if (plugin.pluginMinioObjectPath) {
            // Legacy path: load JSON mapping config from MinIO
            // Used for mapper plugins that pre-date the openldr_external schema
            const pluginStream = await minioUtil.getObject({
              bucketName: "plugins",
              objectName: plugin.pluginMinioObjectPath,
            });

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

            try {
              mappingConfig = JSON.parse(pluginFile);
            } catch (parseError: any) {
              logger.error(
                `Failed to parse mapping configuration for plugin ${dataFeed.mapperPluginId}: ` +
                  `${parseError.message}, continuing with original message`,
              );
            }
          } else {
            logger.warn(
              `Mapper plugin ${dataFeed.mapperPluginId} has neither fieldMappings/systemCode ` +
                `in config nor a pluginMinioObjectPath — skipping terminology mapping`,
            );
          }

          // Apply terminology mappings to the message
          if (mappingConfig) {
            try {
              if (mappingConfig.bySystem) {
                // New field-mapping mode: resolves raw codes to concept UUIDs
                // and cross-system mappings using explicit source/target field config
                processedMessage = applyConceptIdMappings(
                  messageContent,
                  mappingConfig,
                );
              } else {
                // Legacy string-scan mode: scans all string values for concept codes
                processedMessage = applyTerminologyMappings(
                  messageContent,
                  mappingConfig,
                );
              }
              logger.info(
                `Successfully applied terminology mappings for plugin ${dataFeed.mapperPluginId}`,
              );
            } catch (mappingError: any) {
              logger.error(
                `Message mapping failed for plugin ${dataFeed.mapperPluginId}: ` +
                  `${mappingError.message}, continuing with original message`,
              );
            }
          }
        } catch (pluginError: any) {
          logger.error(
            `Plugin processing error for plugin ${dataFeed.mapperPluginId}: ` +
              `${pluginError.message}, continuing with original message`,
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

/**
 * Applies explicit field-to-concept mappings using plugin.config.fieldMappings.
 *
 * For each { sourceField, targetField, systemCode } entry the message is scanned
 * recursively for a key matching sourceField.  When found, the raw code value is
 * looked up in the pre-loaded concept dictionary for that systemCode and the
 * resolved UUID is added to _conceptIds:
 *
 *   _conceptIds: {
 *     organism_concept_id: "uuid",
 *     antibiotic_concept_id: "uuid",
 *     specimen_concept_id:  "uuid",
 *     ...
 *   }
 *
 * Additionally, the full concept data (with cross-system mappings) is stored in
 * _mappings keyed by the raw source code, so downstream consumers can enrich
 * reports without another DB round-trip:
 *
 *   _mappings: {
 *     "eco": { concept: { id, code, name }, mappings: [...] },
 *     "AMK": { concept: { id, code, name }, mappings: [...] }
 *   }
 *
 * plugin.config.fieldMappings example — WHONET microbiology feed:
 *   [
 *     { "sourceField": "organism_code",   "targetField": "organism_concept_id",   "systemCode": "WHONET_ORG"  },
 *     { "sourceField": "antibiotic_code", "targetField": "antibiotic_concept_id", "systemCode": "WHONET_ABX"  },
 *     { "sourceField": "specimen_code",   "targetField": "specimen_concept_id",   "systemCode": "WHONET_SPEC" }
 *   ]
 *
 * plugin.config.fieldMappings example — general lab feed:
 *   [
 *     { "sourceField": "loinc_code",    "targetField": "observation_concept_id", "systemCode": "LOINC" },
 *     { "sourceField": "panel_code",    "targetField": "panel_concept_id",       "systemCode": "LOINC" },
 *     { "sourceField": "icd10_codes",   "targetField": "diagnosis_concept_id",   "systemCode": "ICD10" },
 *     { "sourceField": "specimen_code", "targetField": "specimen_concept_id",    "systemCode": "WHONET_SPEC" }
 *   ]
 */
function applyConceptIdMappings(
  message: any,
  mappingConfig: {
    bySystem: Record<string, Record<string, any>>;
    fieldMappings: Array<{
      sourceField: string;
      targetField: string;
      systemCode: string;
    }>;
  },
) {
  const result = JSON.parse(JSON.stringify(message)); // Deep clone
  const conceptIds: Record<string, string> = {};
  const conceptMappings: Record<string, any> = {};

  scanForConceptIdFields(
    result,
    mappingConfig.fieldMappings,
    mappingConfig.bySystem,
    conceptIds,
    conceptMappings,
  );

  if (Object.keys(conceptIds).length > 0) {
    result._conceptIds = conceptIds;
  }
  if (Object.keys(conceptMappings).length > 0) {
    result._mappings = conceptMappings;
  }

  return result;
}

/**
 * Recursively walks an object looking for keys that match a sourceField name
 * declared in fieldMappings.  When a matching key is found and its value is a
 * non-empty string, the value is looked up in bySystem[systemCode].  On a hit:
 *   - conceptIds[targetField]  is set to the concept UUID
 *   - conceptMappings[rawCode] is set to the full concept + cross-system data
 *
 * Arrays are iterated so that repeated structures (e.g. multiple OBX segments
 * in an HL7 message) are all resolved.
 */
function scanForConceptIdFields(
  obj: any,
  fieldMappings: Array<{
    sourceField: string;
    targetField: string;
    systemCode: string;
  }>,
  bySystem: Record<string, Record<string, any>>,
  conceptIds: Record<string, string>,
  conceptMappings: Record<string, any>,
) {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach((item) =>
      scanForConceptIdFields(
        item,
        fieldMappings,
        bySystem,
        conceptIds,
        conceptMappings,
      ),
    );
    return;
  }

  for (const { sourceField, targetField, systemCode } of fieldMappings) {
    if (sourceField in obj) {
      const rawCode = obj[sourceField];
      if (typeof rawCode === "string" && rawCode) {
        const systemConcepts = bySystem[systemCode];
        if (systemConcepts?.[rawCode]) {
          const conceptData = systemConcepts[rawCode];
          conceptIds[targetField] = conceptData.concept.id;
          conceptMappings[rawCode] = {
            concept: conceptData.concept,
            mappings: conceptData.mappings,
          };
        }
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      scanForConceptIdFields(
        value,
        fieldMappings,
        bySystem,
        conceptIds,
        conceptMappings,
      );
    }
  }
}

/**
 * Applies terminology mappings to a message using the mapping configuration.
 * Legacy mode: scans all string values in the message and checks if they match
 * a concept code in the mapping config.  Used when plugin.config.systemCode is
 * set (single-system, no explicit field targeting).
 *
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
