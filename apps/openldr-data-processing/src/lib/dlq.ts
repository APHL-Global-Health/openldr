import * as minioUtil from '../services/minio.service';
import { safeParseBody } from './pipeline-error';

function extractBucketAndObjectFromKey(rawKey: string | null | undefined) {
  if (!rawKey) return null;
  const parts = rawKey.split('/');
  if (parts.length < 2) return null;
  return {
    bucketName: parts[0],
    objectName: parts.slice(1).join('/'),
  };
}

function parseEventValue(messageValue: any) {
  const parsed = safeParseBody(messageValue);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
}

async function readObjectAsString(bucketName: string, objectName: string) {
  const objectStream = await minioUtil.getObject({ bucketName, objectName });
  let payload = '';
  await new Promise<void>((resolve, reject) => {
    objectStream.on('data', (chunk: any) => {
      payload += chunk.toString();
    });
    objectStream.on('end', () => resolve());
    objectStream.on('error', (err: any) => reject(err));
  });
  return payload;
}

export async function resolveKafkaMessagePayload(message: any): Promise<{
  resolvedPayload: any | null;
  resolvedPayloadError: string | null;
}> {
  try {
    const byKey = extractBucketAndObjectFromKey(message?.key?.toString?.());
    if (byKey) {
      const payload = await readObjectAsString(byKey.bucketName, byKey.objectName);
      return { resolvedPayload: safeParseBody(payload), resolvedPayloadError: null };
    }

    const parsed = parseEventValue(message?.value);
    const bucketName = parsed?.Records?.[0]?.s3?.bucket?.name;
    const encodedObjectKey = parsed?.Records?.[0]?.s3?.object?.key;
    if (bucketName && encodedObjectKey) {
      const objectName = decodeURIComponent(encodedObjectKey).replace(/\+/g, ' ');
      const payload = await readObjectAsString(bucketName, objectName);
      return { resolvedPayload: safeParseBody(payload), resolvedPayloadError: null };
    }

    return { resolvedPayload: null, resolvedPayloadError: 'No resolvable bucket/object path found in Kafka message' };
  } catch (error: any) {
    return {
      resolvedPayload: null,
      resolvedPayloadError: error?.message || 'Failed to resolve payload from MinIO',
    };
  }
}
