import { getConfiguration } from "../../config.js";
import { submitJob } from "./job-controller.js";
import { uploadBuffer } from "../../services/storage.js";

const appConfig = getConfiguration();

export async function submitInfiniteTalkWorkflow(req) {
  const parts = req.parts();
  let imagePath = null;
  let audioPath = null;
  let incomingParams = null;
  for await (const part of parts) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      if (part.fieldname === "image_file") {
        imagePath = await uploadBuffer("input", buffer, part.filename, "images");
      } else if (part.fieldname === "audio_file") {
        audioPath = await uploadBuffer("input", buffer, part.filename, "audio");
      }
    } else {
      if (part.fieldname === "data") {
        try {
          incomingParams = JSON.parse(part.value) || {};
        } catch (e) {
          return { error: "Invalid JSON in data field" };
        }
      }
    }
  }

  const prompt = incomingParams?.prompt || "";
  const refText = incomingParams?.refText || "";
  const params = {
    script: {
      prompt,
      tone: appConfig?.llm?.tone || "casual",
      length: appConfig?.llm?.lengthSeconds || 20,
      persona: appConfig?.llm?.persona || "default",
      model: appConfig?.llm?.model || "llama3",
      temperature:
        typeof appConfig?.llm?.temperature === "number"
          ? appConfig?.llm?.temperature
          : 0.4,
      endpoint: appConfig?.llm?.endpoint,
      timeoutMs: appConfig?.llm?.timeoutMs,
    },
    f5_to_tts: { audioPath, refText },
    infinite_talk: { imagePath },
  };

  return await submitJob({
    mode: "fixed_graph",
    variant: "f5tts_infinitetalk",
    params,
  });
}
