import * as Minio from "minio";

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_HOSTNAME!,
  port: parseInt(process.env.MINIO_API_PORT || "9000", 10),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});
