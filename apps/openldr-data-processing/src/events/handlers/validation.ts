import { utils } from "@repo/openldr-core";
import * as minioUtil from "../../services/minio.service";
import * as dataFeedService from "../../services/datafeed.service";
import * as pluginService from "../../services/plugin.service";
import * as runtimePluginService from "../../services/runtime-plugin.service";
import * as terminologyService from "../../services/terminology.service";
import { logger } from "../../lib/logger";

function parseMessageByContentType(messageData: string, contentType?: string) {
  try {
    if (
      contentType === "application/json" ||
      contentType === "application/fhir+json"
    ) {
      return JSON.parse(messageData);
    }

    if (
      contentType === "application/hl7-v2" ||
      contentType === "application/xml" ||
      contentType === "application/fhir+xml" ||
      contentType === "text/xml" ||
      contentType === "text/csv" ||
      contentType === "text/plain"
    ) {
      return messageData;
    }

    try {
      return JSON.parse(messageData);
    } catch {
      return messageData;
    }
  } catch (error: any) {
    throw new Error(
      `Failed to parse message content (${contentType || "unknown"}): ${
        error.message
      }`,
    );
  }
}

async function readProjectObjectAsString(
  bucketName: string,
  objectName: string,
) {
  const objectStream = await minioUtil.getObject({ bucketName, objectName });
  let messageData = "";
  await new Promise<void>((resolve, reject) => {
    objectStream.on("data", (chunk: any) => {
      messageData += chunk.toString();
    });
    objectStream.on("end", () => resolve());
    objectStream.on("error", (err: any) =>
      reject(new Error(`Failed to read object stream: ${err.message}`)),
    );
  });
  return messageData;
}

async function handleMessage(kafkaMessage: any) {
  try {
    const kafkaValue = JSON.parse(kafkaMessage.value);
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split("/");

    if (!projectId || !dataFeedId) {
      throw new Error(`Invalid message key format: ${key}`);
    }

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw new Error(`Data feed with ID ${dataFeedId} not found`);
    }

    const rawObjectName = `${dataKey}/${dataFeedId}/${objectName}`;
    const messageData = await readProjectObjectAsString(
      projectId,
      rawObjectName,
    );
    const messageContentType =
      kafkaValue?.Records?.[0]?.s3?.object?.userMetadata?.["Content-Type"] ||
      kafkaValue?.Records?.[0]?.s3?.object?.contentType ||
      "application/json";

    const messageContent = parseMessageByContentType(
      messageData,
      messageContentType,
    );
    let processedMessage = messageContent;

    const plugin = await pluginService.resolvePluginOrDefault({
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

    if (!result) {
      logger.info(
        { dataFeedId, pluginId: runtimePlugin.pluginId },
        "Message validation failed, skipping conversion",
      );
      return;
    }

    processedMessage = result;

    const conceptReferences =
      terminologyService.collectConceptReferences(processedMessage);
    if (conceptReferences.length > 0) {
      await terminologyService.assertCodingSystemsExist(
        conceptReferences.map((item) => item.reference.system_id),
      );
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
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Error processing message",
    );
    throw error;
  }
}

export { handleMessage };
