import { randomUUID } from "crypto";
import { extname } from "path";
import { getMinioClient, bucketName } from "../infra/minio.js";

export async function uploadBuffer(buffer, originalFilename) {
  const client = getMinioClient();

  // Generate a unique object name
  const ext = extname(originalFilename);
  const id = randomUUID();
  const objectName = `${id}${ext}`;

  // Upload the buffer
  await client.putObject(bucketName, objectName, buffer);

  return objectName;
}
