export async function generateScript(params, _) {
  const {
    tone,
    length,
    persona,
    model,
    temperature,
    endpoint,
    timeoutMs,
    progressWeight,
    publishProgressCb,
    prompt,
  } = params;

  if (!prompt) throw new Error("Missing prompt for script generation");
  if (!endpoint) throw new Error("LLM endpoint is required");
  if (!model) throw new Error("LLM model is required");
  if (temperature === undefined) throw new Error("LLM temperature is required");
  if (!persona) throw new Error("Persona is required");
  if (!tone) throw new Error("Tone is required");
  if (!length) throw new Error("Length is required");

  const resolvedTimeout = timeoutMs ?? 20000;
  const llmEndpoint = `${endpoint.replace(/\/$/, "")}/api/generate`;
  const template = [
    "You generate two fields for a short talking video:",
    '1) "stagePrompt": a detailed, camera-ready visual description suitable for diffusion (include style, composition, mood).',
    '2) "narration": concise spoken text (<= 80 words) matching the topic and tone.',
    `Topic: ${prompt}`,
    `Tone: ${tone}`,
    `Persona: ${persona}`,
    `Target length: ~${length} seconds of speech.`,
    'Respond ONLY with JSON: {"stagePrompt": "...", "narration": "..."}. No markdown.',
  ].join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolvedTimeout);

  // Emit five evenly spaced progress updates
  const steps = 5;
  const stepWeight =
    typeof progressWeight === "number" && progressWeight > 0
      ? progressWeight / steps
      : 0;
  let currentProgress = 0;
  const bump = async () => {
    if (stepWeight > 0) {
      currentProgress += stepWeight;
      await publishProgressCb(currentProgress);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  await bump();

  let payload;
  try {
    const response = await fetch(llmEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: template,
        temperature,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    await bump();

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `LLM request failed: ${response.status} ${response.statusText} - ${text}`
      );
    }

    payload = await response.json();
  } catch (err) {
    throw new Error(
      `LLM request failed: ${err?.message || err || "unknown error"}`
    );
  }

  const raw = (payload?.response || "").trim();
  const cleaned = raw.replace(/```json|```/gi, "").trim();

  await bump();

  let parsed = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    parsed = {};
  }

  const stagePrompt =
    parsed.stagePrompt ||
    parsed.stage_prompt ||
    cleaned.split("\n").find(Boolean) ||
    `Scene inspired by: ${prompt}`;
  const narration =
    parsed.narration ||
    parsed.script ||
    cleaned ||
    `(${tone}/${persona}) Narration for "${prompt}" lasting ~${length}s.`;

  const tokensUsed =
    (payload?.eval_count || 0) + (payload?.prompt_eval_count || 0) ||
    Math.round(cleaned.length / 4);

  await bump();

  const result = {
    stagePrompt,
    narration,
    tokensUsed,
    model,
    temperature,
    provider: "ollama",
    currentProgress,
  };

  await bump();
  result.currentProgress = currentProgress;
  return result;
}
