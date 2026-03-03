import { utils } from '@repo/openldr-core';
import * as minioUtil from '../../services/minio.service';
import * as dataFeedService from '../../services/datafeed.service';
import * as pluginService from '../../services/plugin.service';
import * as runtimePluginService from '../../services/runtime-plugin.service';
import * as facilityService from '../../services/facility.service';
import { logger } from '../../lib/logger';
import { createStageError } from '../../lib/pipeline-error';

async function enrichMessageWithMetadata(messageContent: any, facilityId: any, dataFeed: any, kafkaMessage: any) {
  const facility = await facilityService.getFacilityById(facilityId);
  const kafkaValue = JSON.parse(kafkaMessage.value);
  const userMetadata = kafkaValue.Records[0].s3.object.userMetadata;

  return {
    ...messageContent,
    _metadata: {
      timestamp: new Date().toISOString(),
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
      data_feed: {
        data_feed_id: dataFeed.dataFeedId,
        data_feed_name: dataFeed.dataFeedName,
        schema_plugin: dataFeed.schemaPlugin || null,
        mapper_plugin: dataFeed.mapperPlugin || null,
        storage_plugin: dataFeed.storagePlugin || dataFeed.recipientPlugin || null,
        outpost_plugin: dataFeed.outpostPlugin || null,
      },
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
  if (!messageContent.patient?.patient_guid) errors.push('patient.patient_guid is required');
  if (!messageContent.lab_request?.request_id) errors.push('lab_request.request_id is required');
  if (messageContent.lab_request) {
    if (!messageContent.lab_request.facility_concept_id) errors.push('lab_request.facility_concept_id is required');
    if (!messageContent.lab_request.panel_concept_id) errors.push('lab_request.panel_concept_id is required');
    if (!messageContent.lab_request.specimen_concept_id) errors.push('lab_request.specimen_concept_id is required');
  }

  const isolateIndices = new Set<number>();
  if (Array.isArray(messageContent.lab_results)) {
    messageContent.lab_results.forEach((result: any, index: number) => {
      if (!result.observation_concept_id) errors.push(`lab_results[${index}].observation_concept_id is required`);
    });
  }
  if (Array.isArray(messageContent.isolates)) {
    messageContent.isolates.forEach((isolate: any, index: number) => {
      if (!isolate.organism_concept_id) errors.push(`isolates[${index}].organism_concept_id is required`);
      if (typeof isolate.isolate_index !== 'number') {
        errors.push(`isolates[${index}].isolate_index is required`);
      } else {
        isolateIndices.add(isolate.isolate_index);
      }
    });
  }
  if (Array.isArray(messageContent.susceptibility_tests)) {
    messageContent.susceptibility_tests.forEach((row: any, index: number) => {
      if (!row.antibiotic_concept_id) errors.push(`susceptibility_tests[${index}].antibiotic_concept_id is required`);
      if (typeof row.isolate_index !== 'number') {
        errors.push(`susceptibility_tests[${index}].isolate_index is required`);
      } else if (!isolateIndices.has(row.isolate_index)) {
        errors.push(`susceptibility_tests[${index}].isolate_index ${row.isolate_index} does not reference an isolate`);
      }
    });
  }

  if (errors.length > 0) {
    throw createStageError({
      stage: 'storage',
      code: 'CANONICAL_STORAGE_VALIDATION_FAILED',
      message: 'Storage validation failed',
      details: { errors },
      retryable: false,
    });
  }
}

async function readProjectObjectAsString(bucketName: string, objectName: string) {
  try {
    const objectStream = await minioUtil.getObject({ bucketName, objectName });
    let objectData = '';
    await new Promise<void>((resolve, reject) => {
      objectStream.on('data', (chunk: any) => {
        objectData += chunk.toString();
      });
      objectStream.on('end', () => resolve());
      objectStream.on('error', (err: any) => reject(err));
    });
    return objectData;
  } catch (error: any) {
    throw createStageError({
      stage: 'storage',
      code: 'SOURCE_OBJECT_READ_FAILED',
      message: 'Failed to read mapped object from MinIO',
      details: { bucket_name: bucketName, object_name: objectName },
      cause: error,
    });
  }
}

export async function handleMessage(kafkaMessage: any) {
  try {
    const kafkaValue = JSON.parse(kafkaMessage.value);
    const key = kafkaMessage.key;
    const [projectId, dataKey, dataFeedId, objectName] = key.split('/');
    const mappedName = `${dataKey}/${dataFeedId}/${objectName}`;

    if (!projectId || !dataFeedId) {
      throw createStageError({
        stage: 'storage',
        code: 'INVALID_MESSAGE_KEY',
        message: 'Invalid Kafka message key format for storage stage',
        details: { key },
        retryable: false,
      });
    }

    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      throw createStageError({
        stage: 'storage',
        code: 'DATA_FEED_NOT_FOUND',
        message: `Data feed with ID ${dataFeedId} not found`,
        details: { data_feed_id: dataFeedId },
        retryable: false,
      });
    }

    const objectData = await readProjectObjectAsString(projectId, mappedName);
    const messageContent = JSON.parse(objectData);
    validateCanonicalStorageRequirements(messageContent);

    const enrichedMessage = await enrichMessageWithMetadata(messageContent, dataFeed.facilityId, dataFeed, kafkaMessage);

    const { plugin, selection } = await pluginService.resolvePluginSelection({
      pluginID: dataFeed.storagePluginId || dataFeed.recipientPluginId,
      pluginType: 'storage',
      pluginVersion: dataFeed.storagePlugin?.pluginVersion || dataFeed.recipientPlugin?.pluginVersion || null,
    });

    const { plugin: runtimePlugin, pluginSource } = await runtimePluginService.readPluginSourceWithFallback(
      'storage',
      plugin,
    );

    const pluginMeta = {
      plugin_id: runtimePlugin.pluginId,
      plugin_name: runtimePlugin.pluginName,
      plugin_version: runtimePlugin.pluginVersion,
    };

    let pluginResult: any;
    try {
      pluginResult = await runtimePluginService.executeProcessPlugin(pluginSource, enrichedMessage, runtimePlugin, 'storage');
    } catch (error: any) {
      throw createStageError({
        stage: 'storage',
        code: 'STORAGE_PLUGIN_FAILED',
        message: error.message || 'Storage plugin execution failed',
        details: { plugin_selection: { ...(enrichedMessage._plugin_selection || {}), storage: selection } },
        plugin: pluginMeta,
        cause: error,
      });
    }

    if (!pluginResult || typeof pluginResult !== 'object') {
      throw createStageError({
        stage: 'storage',
        code: 'INVALID_STORAGE_RESULT',
        message: 'Storage plugin returned an invalid processing result',
        details: { returned_type: typeof pluginResult },
        plugin: pluginMeta,
        retryable: false,
      });
    }

    const processedMessage = {
      ...enrichedMessage,
      _storage: { ...pluginMeta, processed_at: new Date().toISOString() },
      _plugin_selection: {
        ...(enrichedMessage._plugin_selection || {}),
        storage: {
          ...selection,
          runtime_plugin_id: runtimePlugin.pluginId,
          runtime_plugin_name: runtimePlugin.pluginName,
          runtime_plugin_version: runtimePlugin.pluginVersion,
        },
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

    return {
      projectId,
      objectName: messageMetadata.FileName,
      dataFeedId,
      messageId: userMetadata['X-Amz-Meta-Messageid'] || null,
      pluginSelection: processedMessage._plugin_selection,
    };
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Storage stage failed');
    throw error;
  }
}
