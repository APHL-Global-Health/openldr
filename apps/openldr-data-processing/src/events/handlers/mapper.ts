import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import * as runtimePluginService from "../../services/runtime-plugin.service";
import * as terminologyService from "../../services/terminology.service";
import { logger } from "../../lib/logger";
import { createStageError } from "../../lib/pipeline-error";

async function readProjectObjectAsString(
  bucketName: string,
  objectName: string,
) {
  try {
    const objectStream = await minioUtil.getObject({ bucketName, objectName });
    let objectData = "";
    await new Promise<void>((resolve, reject) => {
      objectStream.on("data", (chunk: any) => {
        objectData += chunk.toString();
      });
      objectStream.on("end", () => resolve());
      objectStream.on("error", (err: any) => reject(err));
    });
    return objectData;
  } catch (error: any) {
    throw createStageError({
      stage: "mapping",
      code: "SOURCE_OBJECT_READ_FAILED",
      message: "Failed to read validated object from MinIO",
      details: { bucket_name: bucketName, object_name: objectName },
      cause: error,
    });
  }
}

function normalizeMapperResult(mapperResult: any) {
  if (!mapperResult) {
    return { transformedMessage: null, fieldMappings: null };
  }

  if (Array.isArray(mapperResult)) {
    return { transformedMessage: null, fieldMappings: mapperResult };
  }

  if (mapperResult.transformedMessage) {
    return {
      transformedMessage: mapperResult.transformedMessage,
      fieldMappings: mapperResult.fieldMappings || null,
    };
  }

  if (Array.isArray(mapperResult.fieldMappings)) {
    return {
      transformedMessage: null,
      fieldMappings: mapperResult.fieldMappings,
    };
  }

  return { transformedMessage: null, fieldMappings: null };
}

async function buildLegacyMappingConfig(plugin: any) {
  if (
    plugin.config?.fieldMappings &&
    Array.isArray(plugin.config.fieldMappings) &&
    plugin.config.fieldMappings.length > 0
  ) {
    const systemCodes: string[] = [
      ...new Set<string>(
        plugin.config.fieldMappings
          .map((fm: any) => fm.systemCode as string)
          .filter(Boolean),
      ),
    ];
    const result = await terminologyService.getConceptsBySystemCodes(
      systemCodes,
    );
    if (Object.keys(result.bySystem).length > 0) {
      return {
        bySystem: result.bySystem,
        fieldMappings: plugin.config.fieldMappings,
      };
    }
  }

  if (plugin.config?.systemCode) {
    const result = await terminologyService.getConceptsBySystem(
      plugin.config.systemCode,
    );
    if (Object.keys(result.concepts).length > 0) {
      return result;
    }
  }

  return null;
}

async function handleMessage(kafkaMessage: any) {
  try {
    const kafkaValue = JSON.parse(kafkaMessage.value);
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split("/");
    const validatedName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (!projectId || !dataFeedId) {
      throw createStageError({
        stage: "mapping",
        code: "INVALID_MESSAGE_KEY",
        message: "Invalid Kafka message key format for mapping stage",
        details: { key },
      });
    }

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw createStageError({
        stage: "mapping",
        code: "DATA_FEED_NOT_FOUND",
        message: `Data feed with ID ${dataFeedId} not found`,
        details: { data_feed_id: dataFeedId },
      });
    }

    const objectData = await readProjectObjectAsString(
      projectId,
      validatedName,
    );
    const messageContent = JSON.parse(objectData);
    let processedMessage = messageContent;

    const { plugin, selection } = await pluginService.resolvePluginSelection({
      pluginID: dataFeed.mapperPluginId,
      pluginType: "mapper",
      pluginVersion: dataFeed.mapperPlugin?.pluginVersion || null,
    });

    const { plugin: runtimePlugin, pluginSource } =
      await runtimePluginService.readPluginSourceWithFallback("mapper", plugin);

    const pluginMeta = {
      plugin_id: runtimePlugin.pluginId,
      plugin_name: runtimePlugin.pluginName,
      plugin_version: runtimePlugin.pluginVersion,
    };

    const mapperResult = await runtimePluginService.executeMapperPlugin(
      pluginSource,
      processedMessage,
      runtimePlugin,
    );

    const normalized = normalizeMapperResult(mapperResult);
    if (normalized.transformedMessage) {
      processedMessage = normalized.transformedMessage;
    }

    if (normalized.fieldMappings && normalized.fieldMappings.length > 0) {
      const systemCodes: any[] = [
        ...new Set(
          normalized.fieldMappings
            .map((item: any) => item.systemCode)
            .filter(Boolean),
        ),
      ];
      const result = await terminologyService.getConceptsBySystemCodes(
        systemCodes,
      );
      processedMessage = applyConceptIdMappings(processedMessage, {
        bySystem: result.bySystem,
        fieldMappings: normalized.fieldMappings,
      });
    } else {
      const legacyMappingConfig: any = await buildLegacyMappingConfig(plugin);
      if (legacyMappingConfig) {
        if (legacyMappingConfig.bySystem) {
          processedMessage = applyConceptIdMappings(
            processedMessage,
            legacyMappingConfig,
          );
        } else {
          processedMessage = applyTerminologyMappings(
            processedMessage,
            legacyMappingConfig,
          );
        }
      }
    }

    try {
      processedMessage =
        await terminologyService.resolveConceptReferencesInMessage(
          processedMessage,
        );
    } catch (error: any) {
      throw createStageError({
        stage: "mapping",
        code: "CONCEPT_RESOLUTION_FAILED",
        message:
          error.message ||
          "Failed to resolve concept references in mapped message",
        details: {},
        plugin: pluginMeta,
        cause: error,
      });
    }

    processedMessage = {
      ...processedMessage,
      _mapper: {
        ...pluginMeta,
        mapped_at: new Date().toISOString(),
      },
      _plugin_selection: {
        ...(processedMessage._plugin_selection || {}),
        mapper: {
          ...selection,
          runtime_plugin_id: runtimePlugin.pluginId,
          runtime_plugin_name: runtimePlugin.pluginName,
          runtime_plugin_version: runtimePlugin.pluginVersion,
        },
      },
    };

    const bodyData = JSON.stringify(processedMessage, null, 2);
    const size = Buffer.byteLength(bodyData);
    const userMetadata = kafkaValue.Records[0].s3.object.userMetadata;

    const messageMetadata = utils.generateMessageMetadata({
      dataFeed,
      size,
      messageId: userMetadata["X-Amz-Meta-Messageid"],
      messageDateTime: userMetadata["X-Amz-Meta-Messagedatetime"],
      userId: userMetadata["X-Amz-Meta-Userid"],
      status: "mapped",
      messageContentType: "application/json",
      fileFormat: ".json",
    });

    await minioUtil.putObject({
      bucketName: projectId,
      objectName: messageMetadata.FileName,
      data: bodyData,
      messageMetadata,
    });
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Mapping stage failed",
    );
    throw error;
  }
}

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
  const result = JSON.parse(JSON.stringify(message));
  const conceptIds: Record<string, string> = result._conceptIds || {};
  const conceptMappings: Record<string, any> = result._mappings || {};

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
          conceptMappings[`${systemCode}:${rawCode}`] = {
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

function applyTerminologyMappings(message: any, mappingConfig: any) {
  const processedMessage = JSON.parse(JSON.stringify(message));
  if (!mappingConfig.concepts) {
    return processedMessage;
  }

  const foundConcepts = new Set<string>();
  scanForConcepts(processedMessage, mappingConfig.concepts, foundConcepts);

  if (foundConcepts.size > 0) {
    processedMessage._mappings = processedMessage._mappings || {};
    foundConcepts.forEach((conceptKey: string) => {
      const conceptData = mappingConfig.concepts[conceptKey];
      processedMessage._mappings[conceptKey] = {
        concept: conceptData.concept,
        mappings: conceptData.mappings || [],
      };
    });
  }

  return processedMessage;
}

function scanForConcepts(obj: any, concepts: any, foundConcepts: Set<string>) {
  if (typeof obj === "string") {
    if (concepts[obj]) {
      foundConcepts.add(obj);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item) => scanForConcepts(item, concepts, foundConcepts));
  } else if (obj && typeof obj === "object") {
    Object.values(obj).forEach((value) =>
      scanForConcepts(value, concepts, foundConcepts),
    );
  }
}

export { handleMessage };
