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
  if (!mapperResult) return { transformedMessage: null, fieldMappings: null };
  if (Array.isArray(mapperResult))
    return { transformedMessage: null, fieldMappings: mapperResult };
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
  return { transformedMessage: mapperResult, fieldMappings: null };
}

async function buildLegacyMappingConfig(plugin: any) {
  if (
    plugin.config?.fieldMappings &&
    Array.isArray(plugin.config.fieldMappings) &&
    plugin.config.fieldMappings.length > 0
  ) {
    const systemCodes: any[] = [
      ...new Set(
        plugin.config.fieldMappings
          .map((fm: any) => fm.systemCode)
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
    if (Object.keys(result.concepts).length > 0) return result;
  }
  return null;
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

  function scan(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) return obj.forEach(scan);

    for (const {
      sourceField,
      targetField,
      systemCode,
    } of mappingConfig.fieldMappings) {
      if (!(sourceField in obj)) continue;
      const rawCode = obj[sourceField];
      if (typeof rawCode !== "string" || !rawCode) continue;
      const concept =
        mappingConfig.bySystem?.[systemCode]?.[rawCode.toUpperCase()]?.concept;
      if (!concept) continue;
      obj[targetField] = concept.id;
      conceptIds[`${systemCode}:${rawCode.toUpperCase()}`] = concept.id;
      conceptMappings[sourceField] = {
        targetField,
        systemCode,
        conceptId: concept.id,
      };
    }

    Object.values(obj).forEach(scan);
  }

  scan(result);
  if (Object.keys(conceptIds).length > 0) result._conceptIds = conceptIds;
  if (Object.keys(conceptMappings).length > 0)
    result._mappings = conceptMappings;
  return result;
}

function applyTerminologyMappings(
  message: any,
  mappingConfig: { concepts: Record<string, any> },
) {
  const result = JSON.parse(JSON.stringify(message));
  function scan(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) return obj.forEach(scan);
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const concept = mappingConfig.concepts[value.toUpperCase()]?.concept;
        if (concept) obj[key] = concept.id;
      } else {
        scan(value);
      }
    }
  }
  scan(result);
  return result;
}

export async function handleMessage(kafkaMessage: any) {
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
        retryable: false,
      });
    }

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw createStageError({
        stage: "mapping",
        code: "DATA_FEED_NOT_FOUND",
        message: `Data feed with ID ${dataFeedId} not found`,
        details: { data_feed_id: dataFeedId },
        retryable: false,
      });
    }

    const objectData = await readProjectObjectAsString(
      projectId,
      validatedName,
    );
    let processedMessage = JSON.parse(objectData);

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

    let mapperResult: any;
    try {
      mapperResult = await runtimePluginService.executeMapperPlugin(
        pluginSource,
        processedMessage,
        runtimePlugin,
      );
    } catch (error: any) {
      throw createStageError({
        stage: "mapping",
        code: "MAPPER_PLUGIN_FAILED",
        message: error.message || "Mapper plugin execution failed",
        details: {
          plugin_selection: {
            ...(processedMessage._plugin_selection || {}),
            mapper: selection,
          },
        },
        plugin: pluginMeta,
        cause: error,
      });
    }

    const normalized = normalizeMapperResult(mapperResult);
    if (normalized.transformedMessage)
      processedMessage = normalized.transformedMessage;

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
        processedMessage = legacyMappingConfig.bySystem
          ? applyConceptIdMappings(processedMessage, legacyMappingConfig)
          : applyTerminologyMappings(processedMessage, legacyMappingConfig);
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
        details: {
          plugin_selection: {
            ...(processedMessage._plugin_selection || {}),
            mapper: selection,
          },
        },
        plugin: pluginMeta,
        cause: error,
        retryable: false,
      });
    }

    processedMessage = {
      ...processedMessage,
      _mapper: { ...pluginMeta, mapped_at: new Date().toISOString() },
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
