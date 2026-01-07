import { Client } from "minio";
import { createRequire } from "module";
import { getConfiguration } from "../config.js";

const require = createRequire(import.meta.url);
const appConfig = getConfiguration();

let minioClient;

export function getMinioClient() {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: appConfig.storage.url?.split(":")[1].substr(2),
      port: parseInt(appConfig.storage.url?.split(":")[2], 10),
      useSSL: appConfig.storage.useSSL === "true",
      accessKey: appConfig.storage.accessKey,
      secretKey: appConfig.storage.secretKey,
    });
  }
  return minioClient;
}

export const bucketName = appConfig.storage.bucket;
