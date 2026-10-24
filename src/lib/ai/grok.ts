// Backup provider: xAI Grok, used only when a Claude request fails (outage,
// rate limit, auth problem) — never to route around a Claude refusal.
// Configure with X_GROK_API_KEY and optionally GROK_MODEL (default grok-4.7).

const ENDPOINT = "https://api.x.ai/v1/chat/completions";
export const GROK_MODEL = process.env.GROK_MODEL || "grok-4.7";
export const grokAvailable = () => Boolean(process.env.X_GROK_API_KEY);

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function call(messages: ChatMsg[], maxTokens: number, stream: boolean, signal?: AbortSignal) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.X_GROK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROK_MODEL, messages, max_tokens: maxTokens, stream }),
    signal,
  });
  if (!res.ok) throw new Error(`Grok request failed with HTTP ${res.status}`);
  return res;
}

// Streams the answer as text chunks (OpenAI-style server-sent events).
export async function* grokStream(messages: ChatMsg[], maxTokens: number, signal?: AbortSignal): AsyncGenerator<string> {
  const res = await call(messages, maxTokens, true, signal);
  if (!res.body) throw new Error("Grok returned no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const text = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) yield text;
      } catch { /* ignore keep-alives and partial lines */ }
    }
  }
}

export async function grokComplete(messages: ChatMsg[], maxTokens: number): Promise<string> {
  const res = await call(messages, maxTokens, false);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Grok returned no text");
  return text;
}
