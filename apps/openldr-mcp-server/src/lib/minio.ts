import { Client as MinioClient } from "minio";
import type { Readable } from "stream";

let minioClient: MinioClient | null = null;

export function getMinioClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: process.env.MINIO_HOSTNAME!,
      port: parseInt(process.env.MINIO_API_PORT!),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ROOT_USER!,
      secretKey: process.env.MINIO_ROOT_PASSWORD!,
    });
  }
  return minioClient;
}

export async function getObjectContent(
  bucketName: string,
  objectKey: string,
): Promise<string> {
  const client = getMinioClient();

  const dataStream: Readable = await client.getObject(bucketName, objectKey);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    dataStream.on("data", (chunk: any) => chunks.push(chunk));
    dataStream.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf-8")),
    );
    dataStream.on("error", reject);
  });
}

export async function getObjectMetadata(
  bucketName: string,
  objectKey: string,
): Promise<any> {
  const client = getMinioClient();
  return client.statObject(bucketName, objectKey);
}

export async function listObjects(
  bucketName: string,
  prefix?: string,
): Promise<any[]> {
  const client = getMinioClient();
  const objects: any[] = [];

  return new Promise((resolve, reject) => {
    const stream = client.listObjectsV2(bucketName, prefix, true);

    stream.on("data", (obj) => objects.push(obj));
    stream.on("end", () => resolve(objects));
    stream.on("error", reject);
  });
}
