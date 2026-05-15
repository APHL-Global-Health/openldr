import { S3Client } from "@aws-sdk/client-s3";
import type { LoadedConfig } from "../config.js";

let client: S3Client | undefined;

export function getS3(cfg: LoadedConfig): S3Client {
  if (client) return client;
  client = new S3Client({
    endpoint: cfg.s3.endpoint,
    region: cfg.s3.region,
    forcePathStyle: cfg.s3.forcePathStyle,
    credentials: {
      accessKeyId: cfg.s3.accessKey,
      secretAccessKey: cfg.s3.secretKey,
    },
  });
  return client;
}

export function closeS3(): void {
  if (client) {
    client.destroy();
    client = undefined;
  }
}
