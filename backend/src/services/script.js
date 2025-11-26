export async function generateScript({
  prompt,
  tone = "casual",
  length = 20,
  persona = "default",
  model = "llama3",
  temperature = 0.4,
} = {}) {
  if (!prompt) {
    throw new Error("generateScript requires prompt");
  }

  return {};

  const targetHost =
    process.env.LLM_URL ||
    process.env.OLLAMA_URL ||
    process.env.OLLAMA_HOST ||
    process.env.OPENWEBUI_URL ||
    "http://127.0.0.1:11434";

  const llmEndpoint = `${targetHost.replace(/\/$/, "")}/api/generate`;
  const template = [
    "You generate a stage prompt for diffusion and a spoken narration for a short clip.",
    `Topic: ${prompt}`,
    `Tone: ${tone}`,
    `Persona: ${persona}`,
    `Narration length: ${length} seconds (concise).`,
    'Respond with JSON: {"stagePrompt": "...", "narration": "..."}. No markdown.',
  ].join("\n");

  const response = await fetch(llmEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: template,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `LLM request failed: ${response.status} ${response.statusText} - ${text}`
    );
  }

  const payload = await response.json();
  const raw = (payload.response || "").trim();
  const cleaned = raw.replace(/```json|```/gi, "").trim();

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
    (payload.eval_count || 0) + (payload.prompt_eval_count || 0) ||
    Math.round(cleaned.length / 4);

  return {
    stagePrompt,
    narration,
    tokensUsed,
    model,
    temperature,
  };
}
