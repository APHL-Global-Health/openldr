import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import * as runtimePluginService from "../../services/runtime-plugin.service";
import * as terminologyService from "../../services/terminology.service";
import { logger } from "../../lib/logger";
import * as messageTrackingService from "../../services/message.tracking.service";
import { createStageError } from "../../lib/pipeline-error";

function parseMessageByContentType(messageData: string, contentType?: string) {
  try {
    if (
      contentType === "application/json" ||
      contentType === "application/fhir+json"
    )
      return JSON.parse(messageData);
    try {
      return JSON.parse(messageData);
    } catch {
      return messageData;
    }
  } catch (error: any) {
    throw createStageError({
      stage: "validation",
      code: "MESSAGE_PARSE_FAILED",
      message: `Failed to parse message content (${contentType || "unknown"})`,
      details: { content_type: contentType || "unknown" },
      cause: error,
      retryable: false,
    });
  }
}

async function readProjectObjectAsString(
  bucketName: string,
  objectName: string,
) {
  try {
    const objectStream = await minioUtil.getObject({ bucketName, objectName });
    let messageData = "";
    await new Promise<void>((resolve, reject) => {
      objectStream.on("data", (chunk: any) => {
        messageData += chunk.toString();
      });
      objectStream.on("end", () => resolve());
      objectStream.on("error", (err: any) => reject(err));
    });
    return messageData;
  } catch (error: any) {
    throw createStageError({
      stage: "validation",
      code: "SOURCE_OBJECT_READ_FAILED",
      message: "Failed to read raw source object from MinIO",
      details: { bucket_name: bucketName, object_name: objectName },
      cause: error,
    });
  }
}

export async function handleMessage(kafkaMessage: any) {
  try {
    const kafkaValue = JSON.parse(kafkaMessage.value);
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split("/");

    if (!projectId || !dataFeedId) {
      throw createStageError({
        stage: "validation",
        code: "INVALID_MESSAGE_KEY",
        message: "Invalid Kafka message key format for validation stage",
        details: { key },
        retryable: false,
      });
    }

    const userMetadata =
      kafkaValue?.Records?.[0]?.s3?.object?.userMetadata ?? {};
    const messageId = userMetadata["X-Amz-Meta-Messageid"] || null;

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw createStageError({
        stage: "validation",
        code: "DATA_FEED_NOT_FOUND",
        message: `Data feed with ID ${dataFeedId} not found`,
        details: { data_feed_id: dataFeedId },
        retryable: false,
      });
    }

    const rawObjectName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (messageId) {
      await messageTrackingService.markStageStarted({
        messageId,
        stage: "validation",
        topic: kafkaMessage.topic || "raw-inbound",
        objectPath: `${projectId}/${rawObjectName}`,
        pluginName: dataFeed.schemaPlugin?.pluginName || null,
        pluginVersion: dataFeed.schemaPlugin?.pluginVersion || null,
      });
    }
    const messageData = await readProjectObjectAsString(
      projectId,
      rawObjectName,
    );
    const messageContentType =
      kafkaValue?.Records?.[0]?.s3?.object?.userMetadata?.[
        "X-Amz-Meta-Messagecontenttype"
      ] ||
      kafkaValue?.Records?.[0]?.s3?.object?.userMetadata?.["content-type"] ||
      "application/json";

    const messageContent = parseMessageByContentType(
      messageData,
      messageContentType,
    );

    const { plugin, selection } = await pluginService.resolvePluginSelection({
      pluginID: dataFeed.schemaPluginId,
      pluginType: "schema",
      pluginVersion: dataFeed.schemaPlugin?.pluginVersion || null,
    });

    const { plugin: runtimePlugin, pluginSource } =
      await runtimePluginService.readPluginSourceWithFallback("schema", plugin);

    const result = await runtimePluginService.executeValidationPlugin(
      pluginSource,
      messageContent,
      runtimePlugin,
    );

    if (!result.ok) {
      throw createStageError({
        stage: "validation",
        code: "PLUGIN_VALIDATION_FAILED",
        message: result.reason || "Schema plugin rejected the message",
        details: {
          data_feed_id: dataFeedId,
          plugin_id: runtimePlugin.pluginId,
          plugin_name: runtimePlugin.pluginName,
          plugin_version: runtimePlugin.pluginVersion,
          plugin_selection: {
            schema: {
              ...selection,
              runtime_plugin_id: runtimePlugin.pluginId,
              runtime_plugin_name: runtimePlugin.pluginName,
              runtime_plugin_version: runtimePlugin.pluginVersion,
            },
          },
          validation_details: result.details || {},
        },
        plugin: {
          plugin_id: runtimePlugin.pluginId,
          plugin_name: runtimePlugin.pluginName,
          plugin_version: runtimePlugin.pluginVersion,
        },
        retryable: false,
      });
    }

    let processedMessage = result.converted;
    const conceptReferences =
      terminologyService.collectConceptReferences(processedMessage);
    if (conceptReferences.length > 0) {
      try {
        await terminologyService.assertCodingSystemsExist(
          conceptReferences.map((item) => item.reference.system_id),
        );
      } catch (error: any) {
        throw createStageError({
          stage: "validation",
          code: "UNKNOWN_CODING_SYSTEM",
          message: error.message || "One or more coding systems do not exist",
          details: {
            concept_reference_count: conceptReferences.length,
            referenced_systems: [
              ...new Set(
                conceptReferences.map((item) => item.reference.system_id),
              ),
            ],
            plugin_selection: {
              schema: {
                ...selection,
                runtime_plugin_id: runtimePlugin.pluginId,
                runtime_plugin_name: runtimePlugin.pluginName,
                runtime_plugin_version: runtimePlugin.pluginVersion,
              },
            },
          },
          plugin: {
            plugin_id: runtimePlugin.pluginId,
            plugin_name: runtimePlugin.pluginName,
            plugin_version: runtimePlugin.pluginVersion,
          },
          cause: error,
          retryable: false,
        });
      }
    }

    processedMessage = {
      ...processedMessage,
      _validation: {
        plugin_id: runtimePlugin.pluginId,
        plugin_name: runtimePlugin.pluginName,
        plugin_version: runtimePlugin.pluginVersion,
        concept_reference_count: conceptReferences.length,
        validated_at: new Date().toISOString(),
      },
      _plugin_selection: {
        ...(processedMessage._plugin_selection || {}),
        schema: {
          ...selection,
          runtime_plugin_id: runtimePlugin.pluginId,
          runtime_plugin_name: runtimePlugin.pluginName,
          runtime_plugin_version: runtimePlugin.pluginVersion,
        },
      },
    };

    const bodyData = JSON.stringify(processedMessage, null, 2);
    const size = Buffer.byteLength(bodyData);

    const messageMetadata = utils.generateMessageMetadata({
      dataFeed,
      size,
      messageId: userMetadata["X-Amz-Meta-Messageid"],
      messageDateTime: userMetadata["X-Amz-Meta-Messagedatetime"],
      userId: userMetadata["X-Amz-Meta-Userid"],
      status: "validated",
      messageContentType: "application/json",
      fileFormat: ".json",
    });

    await minioUtil.putObject({
      bucketName: projectId,
      objectName: messageMetadata.FileName,
      data: bodyData,
      messageMetadata,
    });

    if (messageId) {
      await messageTrackingService.markStageCompleted({
        messageId,
        stage: "validation",
        topic: kafkaMessage.topic || "raw-inbound",
        objectPath: `${projectId}/${messageMetadata.FileName}`,
        pluginName:
          runtimePlugin.pluginName || dataFeed.schemaPlugin?.pluginName || null,
        pluginVersion:
          runtimePlugin.pluginVersion ||
          dataFeed.schemaPlugin?.pluginVersion ||
          null,
      });
    }
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Validation stage failed",
    );
    throw error;
  }
}
