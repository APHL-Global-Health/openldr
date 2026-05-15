import { S3Client } from "@aws-sdk/client-s3";
import { Agent as HttpsAgent } from "node:https";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { LoadedConfig } from "../config.js";

let client: S3Client | undefined;

export function getS3(cfg: LoadedConfig): S3Client {
  if (client) return client;
  // S3 (MinIO) cannot go through the HTTPS gateway: nginx rewrites the
  // `/minio/` path prefix before forwarding, which breaks AWS SigV4 signature
  // validation. We connect directly to the MinIO endpoint instead. The
  // operator must either (a) run the CLI inside the docker network, or
  // (b) publish MINIO_API_PORT (9000) on the host in docker-compose.yml.
  client = new S3Client({
    endpoint: cfg.s3.endpoint,
    region: cfg.s3.region,
    forcePathStyle: cfg.s3.forcePathStyle,
    credentials: {
      accessKeyId: cfg.s3.accessKey,
      secretAccessKey: cfg.s3.secretKey,
    },
    requestHandler: new NodeHttpHandler({
      httpsAgent: new HttpsAgent({ rejectUnauthorized: !cfg.insecureTls }),
    }),
  });
  return client;
}

export function closeS3(): void {
  if (client) {
    client.destroy();
    client = undefined;
  }
}
