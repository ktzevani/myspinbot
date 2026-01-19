import { Client } from "minio";
import { getConfiguration } from "../config.js";

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

export function isBucketValid(bucket) {
  return appConfig.storage.buckets.includes(bucket);
}