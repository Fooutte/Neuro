// api/chat.js — Vercel Serverless Function
// Proxies requests to Groq API with CORS support

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Default model if none specified
const DEFAULT_MODEL = "llama-3.1-8b-instant";

// Allowed Groq models
const ALLOWED_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
];

export default async function handler(req, res) {
  // ── CORS Headers ──────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // ── API Key Check ─────────────────────────────────────────────
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not set on the server." });
  }

  // ── Parse & Validate Body ─────────────────────────────────────
  const { messages, model, system, temperature, max_tokens } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Missing or invalid 'messages' field. Expected a non-empty array.",
    });
  }

  const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

  // Build the payload
  const payload = {
    model: selectedModel,
    messages: system
      ? [{ role: "system", content: system }, ...messages]
      : messages,
    temperature: typeof temperature === "number" ? temperature : 0.7,
    max_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
  };

  // ── Call Groq ─────────────────────────────────────────────────
  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data?.error?.message || "Groq API error.",
        details: data,
      });
    }

    // Return clean response
    return res.status(200).json({
      content: data.choices?.[0]?.message?.content ?? "",
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Groq API.", details: err.message });
  }
}
