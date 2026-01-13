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
        progressWeight: 0.15,
        params: { preset: PipelineVariants.F5_TTS_INFINITE_TALK },
      },
      {
        id: "infinite_talk",
        name: "Generate speech video",
        task: "infinite_talk",
        plane: "python",
        progressWeight: 0.55,
        params: { preset: PipelineVariants.F5_TTS_INFINITE_TALK },
      },
    ],
    renderNode: {
      id: "render_video_infinitetalk",
      name: "Render video (WAN+InfiniteTalk)",
      task: "render_video_infinitetalk",
      plane: "python",
      progressWeight: 0.2,
      params: { preset: PipelineVariants.F5_TTS_INFINITE_TALK },
    },
  },
});

function normalizeInput(incomingInput) {
  let input = JSON.parse(JSON.stringify(incomingInput));
  if (!input) throw new PipelineError("[Planner] Empty request input");
  if (!input.mode)
    throw new PipelineError(
      "[Planner] Malformed request input (is mode missing?)."
    );
  if (!Object.values(PipelineModes).includes(input.mode))
    throw new PipelineError(
      `[Planner] Invalid request input, unknown input mode (${input.mode})`
    );
  switch (input.mode) {
    case PipelineModes.PROCESS:
      if (!input.graph)
        throw new PipelineError(
          "[Planner] Malformed request input (is graph missing?)."
        );
      delete input.graph;
      break;
    case PipelineModes.TRAIN_GENERATE:
      if (!input?.scriptInput?.prompt || !input.variant)
        throw new PipelineError(
          "[Planner] Malformed request input (are variant or prompt missing?)."
        );
      if (!Object.values(PipelineVariants).includes(input.variant))
        throw new PipelineError(
          `[Planner] Invalid request input, unknown mode variant (${input.variant})`
        );
      break;
    case PipelineModes.GENERATE:
      if (!input?.scriptInput?.prompt || !input.variant)
        throw new PipelineError(
          "[Planner] Malformed request input (are variant or prompt missing?)"
        );
      break;
  }
  return input;
}

function addCommonParams(node, additionalParams) {
  const clone = JSON.parse(JSON.stringify(node));
  let params = { ...(clone.params || {}) };
  if (additionalParams && Object.keys(additionalParams).length > 0) {
    params = { ...params, ...additionalParams };
  }

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
    progressWeight: 0.1,
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

function buildTrainAndGenerateGraph(
  variantConfig,
  { scriptParams, trainParams, genParams, renderParams }
) {
  const scriptNode = buildScriptNode(scriptParams.prompt);
  const trainNodes = [];
  if (variantConfig?.trainNodes.length > 0) {
    for (let i = 0; i < variantConfig.trainNodes.length; i++) {
      trainNodes.push(
        addCommonParams(variantConfig.trainNodes[i], trainParams[i])
      );
    }
  }
  const generateNodes = [];
  if (variantConfig?.generateNodes.length > 0) {
    for (let i = 0; i < variantConfig.generateNodes.length; i++) {
      generateNodes.push(
        addCommonParams(variantConfig.generateNodes[i], genParams[i])
      );
    }
  }
  const renderNode = addCommonParams(variantConfig.renderNode, renderParams);
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
  { scriptParams, genParams, renderParams }
) {
  const scriptNode = buildScriptNode(scriptParams.prompt);
  const generateNodes = [];
  if (variantConfig?.generateNodes.length > 0) {
    for (let i = 0; i < variantConfig.generateNodes.length; i++) {
      generateNodes.push(
        addCommonParams(variantConfig.generateNodes[i], genParams[i])
      );
    }
  }
  const renderNode = addCommonParams(variantConfig.renderNode, renderParams);
  const nodes = [scriptNode, ...generateNodes, renderNode];
  const edges = [];
  let prevNode = scriptNode;
  if (generateNodes.length > 0) {
    edges.push({ from: prevNode.id, to: generateNodes[0].id, kind: "normal" });
    prevNode = generateNodes[0];
    for (let i = 1; i < generateNodes.length; i++) {
      edges.push({
        from: prevNode.id,
        to: generateNodes[i].id,
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

export function buildPipelineGraph(input) {
  const normalized = normalizeInput(input);

  let template = null;

  switch (input.mode) {
    case PipelineModes.PROCESS:
      template = JSON.parse(input.graph);
      break;
    case PipelineModes.TRAIN_GENERATE:
      template = buildTrainAndGenerateGraph(
        VariantsRegistry[normalized.variant],
        {
          scriptParams: normalized.scriptInput,
          trainParams: normalized?.trainInput || [],
          genParams: normalized?.genInput || [],
          renderParams: normalized?.renderInput || {},
        }
      );
      break;
    case PipelineModes.GENERATE:
      template = buildGenerateOnlyGraph(VariantsRegistry[normalized.variant], {
        scriptParams: normalized.scriptInput,
        genParams: normalized?.genInput || [],
        renderParams: normalized?.renderInput || {},
      });
      break;
  }

  const { scriptInput, trainInput, genInput, renderInput, ...pipelineMeta } =
    normalized;

  return {
    ...template,
    pipelineMeta,
  };
}
