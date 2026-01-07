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
const PipelineVariants = Object.freeze({
  SVD_WAV2LIP: "svd_wav2lip",
  SADTALKER: "sadtalker",
  F5_TTS_INFINITE_TALK: "f5tts_infinitetalk",
});

const VariantsRegistry = Object.freeze({
  [PipelineVariants.SVD_WAV2LIP]: {
    id: PipelineVariants.SVD_WAV2LIP,
    label: "SVD + Wav2Lip",
    trainNodes: [
      {
        id: "train_lora",
        name: "Train LoRA",
        task: "train_lora",
        plane: "python",
        progressWeight: 0.3,
        params: { preset: PipelineVariants.SVD_WAV2LIP },
      },
      {
        id: "train_voice",
        name: "Train voice (TTS)",
        task: "train_voice",
        plane: "python",
        progressWeight: 0.1,
        params: { preset: PipelineVariants.SVD_WAV2LIP },
      },
    ],
    renderNode: {
      id: "render_video",
      name: "Render video (SVD + Wav2Lip)",
      task: "render_video",
      plane: "python",
      progressWeight: 0.4,
      params: { preset: PipelineVariants.SVD_WAV2LIP },
    },
  },
  [PipelineVariants.SADTALKER]: {
    id: PipelineVariants.SADTALKER,
    label: "SadTalker",
    trainNodes: [
      {
        id: "train_voice",
        name: "Train voice (SadTalker)",
        task: "train_voice",
        plane: "python",
        progressWeight: 0.3,
        params: { preset: PipelineVariants.SADTALKER },
      },
    ],
    renderNode: {
      id: "render_video",
      name: "Render video (SadTalker)",
      task: "render_video",
      plane: "python",
      progressWeight: 0.6,
      params: { preset: PipelineVariants.SADTALKER },
    },
  },
  [PipelineVariants.F5_TTS_INFINITE_TALK]: {
    id: PipelineVariants.F5_TTS_INFINITE_TALK,
    label: "InfiniteTalk",
    generateNodes: [
      {
        id: "f5_to_tts",
        name: "Generate voice (F5-TTS)",
        task: "f5_to_tts",
        plane: "python",
        progressWeight: 0.3,
        params: { preset: PipelineVariants.F5_TTS_INFINITE_TALK },
      },
    ],
    renderNode: {
      id: "render_video_infinitetalk",
      name: "Render video (WAN+InfiniteTalk)",
      task: "render_video_infinitetalk",
      plane: "python",
      progressWeight: 0.5,
      params: { preset: PipelineVariants.F5_TTS_INFINITE_TALK },
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
      if (!Object.values(PipelineVariants).includes(request.variant))
        throw new PipelineError(
          `[Planner] Invalid request, unknown mode variant (${request.variant})`
        );
      break;
    case PipelineModes.GENERATE:
      if (!request.prompt || !request.variant)
        throw new PipelineError(
          "[Planner] Malformed request (are variant or prompt missing?)"
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
  const defaultLlm = appConfig?.llm || {};
  const scriptNode = {
    id: "script",
    name: "Generate script",
    task: "script.generateScript",
    plane: "node",
    status: "pending",
    progressWeight: 0.2,
    params: {
      tone: defaultLlm.tone || "casual",
      length: defaultLlm.lengthSeconds || 20,
      persona: defaultLlm.persona || "default",
      model: defaultLlm.model || "llama3",
      temperature:
        typeof defaultLlm.temperature === "number"
          ? defaultLlm.temperature
          : 0.4,
      endpoint: defaultLlm.endpoint,
      timeoutMs: defaultLlm.timeoutMs,
    },
    input: { prompt },
  };
  return addCommonParams(scriptNode);
}

function buildTrainAndGenerateGraph(variantConfig, { prompt, ...options }) {
  const scriptNode = buildScriptNode(prompt);
  const trainNodes =
    variantConfig?.trainNodes.map((node) => addCommonParams(node)) || [];
  const generateNodes =
    variantConfig?.generateNodes.map((node) => addCommonParams(node)) || [];
  const renderNode = addCommonParams(variantConfig.renderNode, options);
  const nodes = [scriptNode, ...trainNodes, ...generateNodes, renderNode];
  const edges = [];
  let prevNode = scriptNode;
  if (trainNodes.length > 0) {
    edges.push({ from: prevNode.id, to: trainNodes[0].id, kind: "normal" });
    prevNode = trainNodes[0];
    for (let i = 1; i < trainNodes.length; i++) {
      edges.push({
        from: trainNodes[i].id,
        to: prevNode.id,
        kind: "normal",
      });
      prevNode = trainNodes[i];
    }
  }
  if (generateNodes.length > 0) {
    edges.push({ from: prevNode.id, to: generateNodes[0].id, kind: "normal" });
    prevNode = generateNodes[0];
    for (let i = 1; i < generateNodes.length; i++) {
      edges.push({
        from: generateNodes[i].id,
        to: prevNode.id,
        kind: "normal",
      });
      prevNode = generateNodes[i];
    }
  }
  edges.push({
    from: prevNode.id,
    to: renderNode.id,
    kind: "normal",
  });
  return { nodes, edges };
}

function buildGenerateOnlyGraph(
  variantConfig,
  { prompt, genParams, renderParams, ...options }
) {
  const scriptNode = buildScriptNode(prompt);
  const generateNodes =
    variantConfig?.generateNodes.map((node) => addCommonParams(node)) || [];
  const renderNode = addCommonParams(variantConfig.renderNode, options);
  renderNode.params = { ...renderNode.params, ...renderParams };
  const nodes = [scriptNode, ...generateNodes, renderNode];
  const edges = [];
  let prevNode = scriptNode;
  if (generateNodes.length > 0) {
    generateNodes[0].params = { ...generateNodes[0].params, ...genParams[0] };
    edges.push({ from: prevNode.id, to: generateNodes[0].id, kind: "normal" });
    prevNode = generateNodes[0];
    for (let i = 1; i < generateNodes.length; i++) {
      generateNodes[i].params = { ...generateNodes[i].params, ...genParams[i] };
      edges.push({
        from: generateNodes[i].id,
        to: prevNode.id,
        kind: "normal",
      });
      prevNode = generateNodes[i];
    }
  }
  edges.push({
    from: prevNode.id,
    to: renderNode.id,
    kind: "normal",
  });
  return { nodes, edges };
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
          // TODO: pass trainParams, genParams and renderParams here
          ...normalized.options,
        }
      );
      break;
    case PipelineModes.GENERATE:
      template = buildGenerateOnlyGraph(VariantsRegistry[normalized.variant], {
        prompt: normalized.prompt,
        genParams: normalized?.genInput || [],
        renderParams: normalized?.renderInput || {},
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
