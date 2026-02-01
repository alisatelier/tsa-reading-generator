const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export async function ollamaChat({ model, messages, stream = false }) {
  const r = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Ollama /api/chat failed (${r.status}): ${text}`);
  }

  return r.json();
}

export async function ollamaEmbed({ model, input }) {
  const r = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: input }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Ollama /api/embeddings failed (${r.status}): ${text}`);
  }

  return r.json();
}
