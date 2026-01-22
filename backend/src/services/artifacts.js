import { randomUUID } from "crypto";
import { extname } from "path";
import { getMinioClient, isBucketValid } from "../infra/minio.js";

export async function uploadArtifact(
  bucket,
  buffer,
  originalFilename,
  subDir = "",
) {
  if (!isBucketValid(bucket)) {
    throw new Error("Invalid bucket");
  }
  const client = getMinioClient();
  // Generate a unique object name
  const ext = extname(originalFilename);
  const id = randomUUID();
  let objectName = `${id}${ext}`;
  if (subDir != "") {
    objectName = `${subDir}/${objectName}`;
  }
  // Upload the buffer
  await client.putObject(bucket, objectName, buffer);
  return `${bucket}/${objectName}`;
}
