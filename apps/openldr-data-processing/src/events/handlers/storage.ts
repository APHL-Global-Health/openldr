import { utils } from '@repo/openldr-core';
import * as minioUtil from '../../services/minio.service';
import * as dataFeedService from '../../services/datafeed.service';
import * as pluginService from '../../services/plugin.service';
import * as runtimePluginService from '../../services/runtime-plugin.service';
import * as facilityService from '../../services/facility.service';
import { logger } from '../../lib/logger';

async function enrichMessageWithMetadata(
  messageContent: any,
  facilityId: any,
  dataFeed: any,
  kafkaMessage: any,
) {
  const facility = await facilityService.getFacilityById(facilityId);
  const kafkaValue = JSON.parse(kafkaMessage.value);
  const userMetadata = kafkaValue.Records[0].s3.object.userMetadata;

  const data_feed: any = {
    data_feed_id: dataFeed.dataFeedId,
    data_feed_name: dataFeed.dataFeedName,
    data_feed_description: dataFeed.description,
    schema_plugin: dataFeed.schemaPlugin || null,
    mapper_plugin: dataFeed.mapperPlugin || null,
    recipient_plugin: dataFeed.recipientPlugin || null,
  };

  return {
    ...messageContent,
    _metadata: {
      timestamp: new Date().toISOString(),
      environment: process.env.HOST_ENVIRONMENT,
      host_ip: process.env.HOST_IP,
      project: userMetadata['X-Amz-Meta-Project'] || null,
      use_case: userMetadata['X-Amz-Meta-Usecase'] || null,
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
        message_id: userMetadata['X-Amz-Meta-Messageid'] || null,
        message_datetime: userMetadata['X-Amz-Meta-Messagedatetime'] || null,
        user_id: userMetadata['X-Amz-Meta-Userid'] || null,
        filename: userMetadata['X-Amz-Meta-Filename'] || null,
      },
    },
  };
}

function validateCanonicalStorageRequirements(messageContent: any) {
  const errors: string[] = [];

  if (messageContent.lab_request) {
    if (!messageContent.lab_request.facility_concept_id) {
      errors.push('lab_request.facility_concept_id is required');
    }
    if (!messageContent.lab_request.panel_concept_id) {
      errors.push('lab_request.panel_concept_id is required');
    }
  }

  if (Array.isArray(messageContent.lab_results)) {
    messageContent.lab_results.forEach((result: any, index: number) => {
      if (!result.observation_concept_id) {
        errors.push(`lab_results[${index}].observation_concept_id is required`);
      }
    });
  }

  if (Array.isArray(messageContent.isolates)) {
    messageContent.isolates.forEach((isolate: any, index: number) => {
      if (!isolate.organism_concept_id) {
        errors.push(`isolates[${index}].organism_concept_id is required`);
      }
    });
  }

  if (Array.isArray(messageContent.susceptibility_tests)) {
    messageContent.susceptibility_tests.forEach((row: any, index: number) => {
      if (!row.antibiotic_concept_id) {
        errors.push(`susceptibility_tests[${index}].antibiotic_concept_id is required`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Storage validation failed: ${errors.join('; ')}`);
  }
}

async function readProjectObjectAsString(bucketName: string, objectName: string) {
  const objectStream = await minioUtil.getObject({ bucketName, objectName });
  let objectData = '';
  await new Promise<void>((resolve, reject) => {
    objectStream.on('data', (chunk: any) => {
      objectData += chunk.toString();
    });
    objectStream.on('end', () => resolve());
    objectStream.on('error', (err: any) => reject(new Error(`Failed to read object stream: ${err.message}`)));
  });
  return objectData;
}

async function handleMessage(kafkaMessage: any) {
  try {
    const kafkaValue = JSON.parse(kafkaMessage.value);
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split('/');
    const mapperName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (!projectId || !dataFeedId) {
      throw new Error(`Invalid message key format: ${key}`);
    }

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw new Error(`Data feed with ID ${dataFeedId} not found`);
    }

    const objectData = await readProjectObjectAsString(projectId, mapperName);
    const messageContent = JSON.parse(objectData);
    validateCanonicalStorageRequirements(messageContent);

    const enrichedMessage = await enrichMessageWithMetadata(
      messageContent,
      dataFeed.facilityId,
      dataFeed,
      kafkaMessage,
    );

    const plugin = await pluginService.resolvePluginOrDefault({
      pluginID: dataFeed.recipientPluginId,
      pluginType: 'recipient',
      pluginVersion: dataFeed.recipientPlugin?.pluginVersion || null,
    });

    const { plugin: runtimePlugin, pluginSource } = await runtimePluginService.readPluginSourceWithFallback(
      'recipient',
      plugin,
    );

    let pluginResult: any;
    try {
      pluginResult = await runtimePluginService.executeRecipientPlugin(
        pluginSource,
        enrichedMessage,
        runtimePlugin,
      );
    } catch (pluginError: any) {
      logger.error(
        { error: pluginError.message, pluginId: runtimePlugin.pluginId },
        'Recipient plugin execution failed',
      );
      pluginResult = {
        success: false,
        processed: { patients: 0, requests: 0, results: 0 },
        errors: [pluginError.message],
        record_ids: { patients: [], requests: [], results: [] },
        processing_completed: new Date().toISOString(),
      };
    }

    const processedMessage = {
      ...enrichedMessage,
      _storage: {
        plugin_id: runtimePlugin.pluginId,
        plugin_name: runtimePlugin.pluginName,
        plugin_version: runtimePlugin.pluginVersion,
        processed_at: new Date().toISOString(),
      },
      _processing_results: pluginResult,
    };

    const bodyData = JSON.stringify(processedMessage, null, 2);
    const size = Buffer.byteLength(bodyData);
    const userMetadata = kafkaValue.Records[0].s3.object.userMetadata;

    const messageMetadata = utils.generateMessageMetadata({
      dataFeed,
      size,
      messageId: userMetadata['X-Amz-Meta-Messageid'],
      messageDateTime: userMetadata['X-Amz-Meta-Messagedatetime'],
      userId: userMetadata['X-Amz-Meta-Userid'],
      status: 'processed',
      messageContentType: 'application/json',
      fileFormat: '.json',
    });

    await minioUtil.putObject({
      bucketName: projectId,
      objectName: messageMetadata.FileName,
      data: bodyData,
      messageMetadata,
    });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing message');
    throw error;
  }
}

export { handleMessage };
