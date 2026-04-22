import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import * as runtimePluginService from "../../services/runtime-plugin.service";
import { logger } from "../../lib/logger";
import * as messageTrackingService from "../../services/message.tracking.service";
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
      stage: "outpost",
      code: "SOURCE_OBJECT_READ_FAILED",
      message: "Failed to read processed object from MinIO",
      details: { bucket_name: bucketName, object_name: objectName },
      cause: error,
    });
  }
}

export async function handleMessage(kafkaMessage: any) {
  try {
    const eventValue = JSON.parse(kafkaMessage.value);
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split("/");

    if (!projectId || !dataFeedId) {
      throw createStageError({
        stage: "outpost",
        code: "INVALID_MESSAGE_KEY",
        message: "Invalid Kafka message key format for outpost stage",
        details: { key },
        retryable: false,
      });
    }

    const userMetadata =
      eventValue?.Records?.[0]?.s3?.object?.userMetadata ?? {};
    const messageId = userMetadata["X-Amz-Meta-Messageid"] || null;

    // Skip deleted runs
    if (messageId && await messageTrackingService.isRunDeleted(messageId)) {
      logger.info({ messageId }, "Skipping deleted run in outpost");
      return;
    }

    const objectNameFromEvent =
      eventValue?.processed_object?.object_name ||
      `${dataKey}/${dataFeedId}/${objectName}`;
    const objectData = await readProjectObjectAsString(
      projectId,
      objectNameFromEvent,
    );
    const messageContent = JSON.parse(objectData);

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw createStageError({
        stage: "outpost",
        code: "DATA_FEED_NOT_FOUND",
        message: `Data feed with ID ${dataFeedId} not found`,
        details: { data_feed_id: dataFeedId, resolved_payload: messageContent },
        retryable: false,
      });
    }

    if (messageId) {
      await messageTrackingService.markStageStarted({
        messageId,
        stage: "outpost",
        topic: kafkaMessage.topic || "processed-inbound",
        objectPath: `${projectId}/${objectNameFromEvent}`,
        pluginName: dataFeed.outpostPlugin?.pluginName || null,
        pluginVersion: dataFeed.outpostPlugin?.pluginVersion || null,
      });
    }

    const { plugin, selection } = await pluginService.resolvePluginSelection({
      pluginID: dataFeed.outpostPluginId || null,
      pluginType: "outpost",
      pluginVersion: dataFeed.outpostPlugin?.pluginVersion || null,
    });

    const { plugin: runtimePlugin, pluginSource } =
      await runtimePluginService.readPluginSourceWithFallback(
        "outpost",
        plugin,
      );

    const pluginMeta = {
      plugin_id: runtimePlugin.pluginId,
      plugin_name: runtimePlugin.pluginName,
      plugin_version: runtimePlugin.pluginVersion,
    };

    let pluginResult: any;
    try {
      pluginResult = await runtimePluginService.executeProcessPlugin(
        pluginSource,
        messageContent,
        runtimePlugin,
        "outpost",
      );
    } catch (error: any) {
      throw createStageError({
        stage: "outpost",
        code: "OUTPOST_PLUGIN_FAILED",
        message: error.message || "Outpost plugin execution failed",
        details: {
          resolved_payload: messageContent,
          plugin_selection: {
            ...(messageContent._plugin_selection || {}),
            outpost: selection,
          },
        },
        plugin: pluginMeta,
        cause: error,
      });
    }

    if (messageId) {
      await messageTrackingService.markStageCompleted({
        messageId,
        stage: "outpost",
        topic: kafkaMessage.topic || "processed-inbound",
        objectPath: `${projectId}/${objectNameFromEvent}`,
        pluginName:
          runtimePlugin.pluginName ||
          dataFeed.outpostPlugin?.pluginName ||
          null,
        pluginVersion:
          runtimePlugin.pluginVersion ||
          dataFeed.outpostPlugin?.pluginVersion ||
          null,
      });
    }

    logger.info(
      {
        outpost_result: pluginResult,
        plugin: pluginMeta,
        message_id: messageId,
      },
      "Outpost stage completed",
    );

    return {
      success: true,
      outpost: pluginResult,
      plugin: pluginMeta,
    };
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Outpost stage failed",
    );
    throw error;
  }
}
