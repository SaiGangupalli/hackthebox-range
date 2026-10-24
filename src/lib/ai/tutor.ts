import Anthropic from "@anthropic-ai/sdk";
import { tracks } from "@/data/tracks";
import { quiz } from "@/data/quiz";
import { labBriefs } from "@/data/labs";
import { recipes } from "@/data/commands";
import { drillById } from "@/data/drills";
import { HELP } from "@/lib/sim/shell";
import { TUTOR_RULES, pageContext } from "./context";
import { grokAvailable, grokStream, type ChatMsg } from "./grok";

// The AI tutor. The browser sends *what* it wants (a chat message, "explain this
// command", "nudge me on objective 2", "explain this quiz answer"); the prompt is
// built here from the site's own content, so clients can't inject instructions
// and the tutor never sees lab solutions or challenge flags.

export const MODEL = "claude-opus-5-5";
export const RESET = "\u0000RESET\u0000"; // tells the client to discard text streamed so far

export type Ask =
  | { kind: "chat"; text: string }
  | { kind: "explain-command"; command: string }
  | { kind: "nudge"; labId: string; index: number }
  | { kind: "quiz-explain"; question: string; picked: string }
  | { kind: "drill-help"; drillId: string; command?: string; output?: string };

export type Turn = { role: "user" | "assistant"; content: string };

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

// Every command the site shows with an Explain button, with where it's from and
// how the page describes it. Explain requests must name one of these.
const KNOWN_COMMANDS = new Map<string, { from: string; note: string }>();
for (const t of Object.values(tracks)) for (const sh of t.sheets) for (const r of sh.rows) KNOWN_COMMANDS.set(r.code, { from: `the "${t.title}" track's quick reference`, note: r.note });
for (const [name, [desc, example]] of Object.entries(HELP)) if (!KNOWN_COMMANDS.has(example)) KNOWN_COMMANDS.set(example, { from: "the command handbook", note: `${name} — ${desc}` });
for (const r of recipes) if (!KNOWN_COMMANDS.has(r.cmd)) KNOWN_COMMANDS.set(r.cmd, { from: "the command handbook's recipes", note: r.does });

// Turn a validated request into the user message Claude sees.
export function buildPrompt(ask: Ask): { prompt: string } | { error: string } {
  switch (ask?.kind) {
    case "chat": {
      const text = String(ask.text ?? "").trim();
      if (!text) return { error: "Type a question first." };
      return { prompt: clip(text, 2000) };
    }
    case "explain-command": {
      const known = KNOWN_COMMANDS.get(String(ask.command ?? ""));
      if (!known) return { error: "That command isn't in the site's references." };
      return { prompt: `Explain this command from ${known.from} in plain English: \`${ask.command}\` (the page describes it as: ${known.note}). Break it into its parts and say what each one does, show what the output typically looks like, and say when I'd use it. If it's relevant, add one line on how defenders notice or limit it.` };
    }
    case "nudge": {
      const lab = labBriefs[ask.labId];
      const o = lab?.objectives[Number(ask.index)];
      if (!lab || !o) return { error: "Unknown lab objective." };
      return { prompt: `I'm working on the lab "${lab.title}" and I'm stuck on objective ${Number(ask.index) + 1}: "${o.ask}". The lab's own approach hint says: ${o.hint} Give me a nudge toward the next step — a question to think about or one thing to try — without telling me the answer.` };
    }
    case "quiz-explain": {
      for (const [slug, qs] of Object.entries(quiz)) {
        const q = qs.find((x) => x.q === ask.question);
        if (!q) continue;
        const picked = String(ask.picked ?? "");
        if (picked !== q.right && !q.wrong.includes(picked)) return { error: "That answer isn't one of the options." };
        const right = picked === q.right;
        return { prompt: `Quiz question from the "${tracks[slug]?.title ?? slug}" track: "${q.q}" I picked "${picked}"${right ? ", which was correct" : `, but the correct answer is "${q.right}"`}. The short explanation was: ${q.why} ${right ? "Explain the idea a bit more deeply and give me one real-world example so it sticks." : "Explain why my answer doesn't fit and why the correct one does, with an everyday example so I remember it."}` };
      }
      return { error: "Unknown quiz question." };
    }
    case "drill-help": {
      const d = drillById[String(ask.drillId ?? "")];
      if (!d) return { error: "Unknown drill." };
      const cmd = clip(String(ask.command ?? "").trim(), 300);
      const out = clip(String(ask.output ?? "").replace(/[\x00-\x08\x0b-\x1f]/g, ""), 1500).trim();
      const tried = cmd
        ? `I ran \`${cmd}\` and got:\n\`\`\`\n${out || "(no output)"}\n\`\`\`\nExplain in simple words what my command actually did and what's missing,`
        : "I haven't tried anything yet. Explain how to think about it,";
      return { prompt: `I'm practising terminal commands in the site's command dojo (a simulated Linux shell; my home folder is /home/learner). The drill: "${d.task}" ${tried} then nudge me toward a command that completes the drill. Teach the idea — let me type the final command myself.` };
    }
  }
  return { error: "Unknown request." };
}

// Keep the last few turns, trimmed, starting with a user turn.
export function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .filter((t): t is Turn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim() !== "")
    .slice(-12)
    .map((t) => ({ role: t.role, content: clip(t.content, 4000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

// Errors where the backup provider should take over: anything except a malformed
// request (400), which would fail on Grok too and points at a bug.
function backupEligible(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) return err.status !== 400;
  return true; // connection problems, missing credentials, timeouts
}

export function streamTutor(opts: { prompt: string; history: Turn[]; page?: string; signal?: AbortSignal }): ReadableStream<Uint8Array> {
  const ctx = pageContext(opts.page);
  const enc = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      const push = (t: string) => { if (t) { sent = true; controller.enqueue(enc.encode(t)); } };
      try {
        const client = new Anthropic(); // reads ANTHROPIC_API_KEY
        const stream = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default", // a declined request is re-run on Anthropic's recommended fallback model
            output_config: { effort: "low" }, // tutoring chat: quick, focused answers
            system: [
              { type: "text", text: TUTOR_RULES },
              { type: "text", text: ctx.text, cache_control: { type: "ephemeral" } },
            ],
            messages: [...opts.history, { role: "user", content: opts.prompt }],
          },
          { signal: opts.signal },
        );
        for await (const event of stream) {
          // A fallback block means the first model declined mid-answer and another
          // model takes over: drop what was shown so far.
          if (event.type === "content_block_start" && event.content_block.type === "fallback" && sent) controller.enqueue(enc.encode(RESET));
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") push(event.delta.text);
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(enc.encode(RESET + "I can't help with that one. Try asking how it works conceptually, or how defenders detect and prevent it."));
        } else if (final.stop_reason === "max_tokens") {
          push("\n\n_(The answer was cut short — ask me to continue.)_");
        }
      } catch (err) {
        if (opts.signal?.aborted) { controller.close(); return; }
        console.error("[tutor] Claude request failed:", err instanceof Anthropic.APIError ? `HTTP ${err.status}` : (err as Error)?.name);
        if (!sent && backupEligible(err) && grokAvailable()) {
          try {
            const msgs: ChatMsg[] = [{ role: "system", content: `${TUTOR_RULES}\n\n${ctx.text}` }, ...opts.history, { role: "user", content: opts.prompt }];
            for await (const t of grokStream(msgs, 4000, opts.signal)) push(t);
            push("\n\n_Answered by the backup model because Claude was unavailable._");
          } catch (e2) {
            console.error("[tutor] Grok backup failed:", (e2 as Error)?.message);
            if (!sent) push("The tutor is unavailable right now. Please try again in a minute.");
          }
        } else if (sent) {
          push("\n\n_(The connection was interrupted — please ask again.)_");
        } else {
          push("The tutor is unavailable right now. Please try again in a minute.");
        }
      }
      controller.close();
    },
  });
}
