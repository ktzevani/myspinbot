export async function uploadArtifact({
  images = [],
  audio = null,
  artifactId = null,
  metadata = {},
} = {}) {
  if (!images.length) {
    throw new Error("uploadArtifact requires at least one image");
  }

  const resolvedArtifactId =
    artifactId ||
    `artifact_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;

  // TODO: implement MinIO upload + presigned URL handling.
  return {
    artifactId: resolvedArtifactId,
    bucket: "artifacts",
    objects: {
      images: images.map(
        (_img, idx) => `artifacts/${resolvedArtifactId}/image_${idx}.png`
      ),
      audio: audio ? `artifacts/${resolvedArtifactId}/audio.wav` : null,
    },
    metadata,
  };
}

export async function prepareAssets({
  artifactId,
  requestedKinds = ["images", "audio"],
  enrichments = {},
} = {}) {
  if (!artifactId) {
    throw new Error("prepareAssets requires artifactId");
  }

  // TODO: read object metadata from MinIO and enrich as requested.
  return {
    artifactId,
    manifest: {
      images: requestedKinds.includes("images")
        ? [
            {
              key: `artifacts/${artifactId}/image_0.png`,
              checksum: "stub-checksum",
              width: 512,
              height: 512,
            },
          ]
        : [],
      audio: requestedKinds.includes("audio")
        ? {
            key: `artifacts/${artifactId}/audio.wav`,
            durationSeconds: enrichments.audioDuration ? 10.5 : undefined,
          }
        : null,
    },
  };
}
