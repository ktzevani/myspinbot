import { normalize } from "node:path";
import { getConfiguration } from "../config.js";

const appConfig = getConfiguration();

export class PipelineError extends Error {
  constructor(msg) {
    super(msg);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

const PipelineModes = appConfig.bridge.planning.pipelines;
const TrainVariants = Object.freeze({
  SVD_WAV2LIP: "svd_wav2lip",
  SADTALKER: "sadtalker",
});

const VariantsRegistry = Object.freeze({
  [TrainVariants.SVD_WAV2LIP]: {
    id: TrainVariants.SVD_WAV2LIP,
    label: "SVD + Wav2Lip",
    trainNodes: [
      {
        id: "train_lora",
        name: "Train LoRA",
        task: "train_lora",
        plane: "python",
        progressWeight: 0.3,
        params: { preset: TrainVariants.SVD_WAV2LIP },
      },
      {
        id: "train_voice",
        name: "Train voice (TTS)",
        task: "train_voice",
        plane: "python",
        progressWeight: 0.1,
        params: { preset: TrainVariants.SVD_WAV2LIP },
      },
    ],
    renderNode: {
      id: "render_video",
      name: "Render video (SVD + Wav2Lip)",
      task: "render_video",
      plane: "python",
      progressWeight: 0.4,
      params: { preset: TrainVariants.SVD_WAV2LIP },
    },
  },
  [TrainVariants.SADTALKER]: {
    id: TrainVariants.SADTALKER,
    label: "SadTalker",
    trainNodes: [
      {
        id: "train_voice",
        name: "Train voice (SadTalker)",
        task: "train_voice",
        plane: "python",
        progressWeight: 0.3,
        params: { preset: TrainVariants.SADTALKER },
      },
    ],
    renderNode: {
      id: "render_video",
      name: "Render video (SadTalker)",
      task: "render_video",
      plane: "python",
      progressWeight: 0.6,
      params: { preset: TrainVariants.SADTALKER },
    },
  },
});

function sanitizeOptions({ durationSeconds = {}, resolution = {} }) {
  return {
    durationSeconds: Number.isFinite(durationSeconds)
      ? Math.max(1, Number(durationSeconds))
      : {},
    resolution:
      typeof resolution === "string" && resolution.trim().length > 0
        ? resolution.trim()
        : {},
  };
}

function normalizeRequest(incomingRequest) {
  let request = JSON.parse(JSON.stringify(incomingRequest));
  if (!request) throw new PipelineError("[Planner] Empty request");
  if (!request.mode)
    throw new PipelineError("[Planner] Malformed request (is mode missing?).");
  if (!Object.values(PipelineModes).includes(request.mode))
    throw new PipelineError(
      `[Planner] Invalid request, unknown request mode (${request.mode})`
    );
  switch (request.mode) {
    case PipelineModes.PROCESS:
      if (!request.graph)
        throw new PipelineError(
          "[Planner] Malformed request (is graph missing?)."
        );
      delete request.graph;
      break;
    case PipelineModes.TRAIN_GENERATE:
      if (!request.variant || !request.prompt)
        throw new PipelineError(
          "[Planner] Malformed request (are variant or prompt missing?)."
        );
      if (!Object.values(TrainVariants).includes(request.variant))
        throw new PipelineError(
          `[Planner] Invalid request, unknown mode variant (${request.variant})`
        );
      break;
    case PipelineModes.GENERATE:
      if (!request.profileId || !request.prompt || !request.variant)
        throw new PipelineError(
          "[Planner] Malformed request (are variant, profileId or prompt missing?)"
        );
      break;
  }
  if (request.mode != PipelineModes.PROCESS) {
    request.options = sanitizeOptions(request.options || {});
  }
  return request;
}

function addCommonParams(node, options) {
  const clone = JSON.parse(JSON.stringify(node));
  const params = { ...(clone.params || {}) };
  if (options && Object.keys(options).length > 0) params.options = options;

  return {
    ...clone,
    params,
    status: clone.status || "pending",
    progressWeight:
      typeof clone.progressWeight === "number" ? clone.progressWeight : 0,
  };
}

function buildScriptNode(prompt) {
  const scriptNode = {
    id: "script",
    name: "Generate script",
    task: "script.generateScript",
    plane: "node",
    status: "pending",
    progressWeight: 0.2,
    params: {
      tone: "casual",
      length: 20,
      persona: "default",
      model: "llama3",
      temperature: 0.4,
    },
    input: { prompt },
  };
  return addCommonParams(scriptNode);
}

function buildTrainAndGenerateGraph(variantConfig, { prompt, ...options }) {
  const scriptNode = buildScriptNode(prompt);
  const trainNodes = variantConfig.trainNodes.map((node) =>
    addCommonParams(node)
  );
  const renderNode = addCommonParams(variantConfig.renderNode, options);
  const nodes = [scriptNode, ...trainNodes, renderNode];
  const edges = [];
  for (const node of trainNodes) {
    edges.push({ from: scriptNode.id, to: node.id, kind: "normal" });
    edges.push({ from: node.id, to: renderNode.id, kind: "normal" });
  }
  return { nodes, edges };
}

function buildGenerateOnlyGraph(
  variantConfig,
  { prompt, profileId, ...options }
) {
  const scriptNode = buildScriptNode(prompt);
  const renderNode = addCommonParams(
    {
      ...variantConfig.renderNode,
      params: { ...variantConfig.renderNode.params, profileId },
    },
    options
  );
  return {
    nodes: [scriptNode, renderNode],
    edges: [{ from: scriptNode.id, to: renderNode.id, kind: "normal" }],
  };
}

// TODO: Revisit overall design of this module, its going to change as pipelines improve

export function buildPipelineGraph(request) {
  const normalized = normalizeRequest(request);

  let template = null;

  switch (request.mode) {
    case PipelineModes.PROCESS:
      template = JSON.parse(request.graph);
      break;
    case PipelineModes.TRAIN_GENERATE:
      template = buildTrainAndGenerateGraph(
        VariantsRegistry[normalized.variant],
        {
          prompt: normalized.prompt,
          ...normalized.options,
        }
      );
      break;
    case PipelineModes.GENERATE:
      template = buildGenerateOnlyGraph(VariantsRegistry[normalized.variant], {
        prompt: normalized.prompt,
        profileId: normalized.profileId,
        ...normalized.options,
      });
      break;
  }

  const { prompt, options, ...pipelineMeta } = normalized;

  return {
    ...template,
    pipelineMeta,
  };
}
