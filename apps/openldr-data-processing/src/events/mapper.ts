import { Kafka } from 'kafkajs';
import * as messageHandler from './handlers/mapper';
import { logger } from '../lib/logger';
import { buildDlqBody } from '../lib/pipeline-error';
import { resolveKafkaMessagePayload } from '../lib/dlq';

export const start = async () => {
  try {
    const kafka = new Kafka({ clientId: 'openldr-mapper', brokers: ['openldr-kafka1:19092'] });
    const producer = kafka.producer();
    await producer.connect();

    const consumer = kafka.consumer({ groupId: 'openldr-mapper-consumer' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'validated-inbound', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          await messageHandler.handleMessage({
            topic,
            partition,
            offset: message.offset,
            value: message.value?.toString(),
            key: message.key?.toString(),
          });
        } catch (err: any) {
          logger.error({ err, topic, partition }, 'Message failed — routing to DLQ');
          const { resolvedPayload, resolvedPayloadError } = await resolveKafkaMessagePayload(message);
          const dlqBody = buildDlqBody({
            topic,
            partition,
            message,
            error: err,
            resolvedPayload,
            resolvedPayloadError,
            pluginSelection: resolvedPayload?._plugin_selection || err?.details?.plugin_selection || null,
          });
          await producer.send({
            topic: `${topic}-dead-letter`,
            messages: [{
              key: message.key,
              value: JSON.stringify(dlqBody),
              headers: {
                ...message.headers,
                'x-dlq-error': err.message,
                'x-dlq-topic': topic,
                'x-dlq-timestamp': new Date().toISOString(),
                'x-dlq-error-id': dlqBody.dlq.error.error_id,
              },
            }],
          });
        }
      },
    });

    logger.info('Mapper service running and consuming messages');
  } catch (err: any) {
    logger.error({ error: err.message, stack: err.stack }, 'Mapper service initialization failed');
  }
};
