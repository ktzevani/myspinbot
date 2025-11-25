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

  // TODO: invoke local LLM (Ollama/OpenWebUI) with templated prompt.
  return {
    stagePrompt: `Scene inspired by: ${prompt}`,
    narration: `(${tone}/${persona}) This is a placeholder narration for "${prompt}" lasting ~${length}s.`,
    tokensUsed: Math.round(prompt.length * 1.2),
    model,
    temperature,
  };
}
