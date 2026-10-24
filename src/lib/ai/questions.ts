import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { quiz, type Question } from "@/data/quiz";
import { tracks } from "@/data/tracks";
import { TUTOR_RULES, trackSlugContext } from "./context";
import { grokAvailable, grokComplete } from "./grok";
import { MODEL } from "./tutor";

// Fresh practice questions for a track, written by Claude in a fixed JSON shape
// and then checked here (one right answer, three distinct wrong ones, sane
// lengths, no repeats of the built-in questions).

const COUNT = 5;

const Schema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      correct: z.string(),
      wrong: z.array(z.string()),
      why: z.string(),
    }),
  ),
});

export class RefusedError extends Error {}

function instructions(slug: string): string {
  const existing = (quiz[slug] ?? []).map((q) => `- ${q.q}`).join("\n");
  return `Write ${COUNT} new multiple-choice questions for the "${tracks[slug].title}" track, for a beginner-to-intermediate learner.
Each question has exactly one correct answer, three plausible but clearly wrong answers, and a one- or two-sentence plain-English explanation of the correct answer.
Test understanding of concepts, how to read tool output, and how to defend — not trivia. Keep every answer under 15 words and every question under 40 words.
Don't repeat or closely paraphrase these existing questions:
${existing}`;
}

function clean(raw: z.infer<typeof Schema>, slug: string): Question[] {
  const seen = new Set((quiz[slug] ?? []).map((q) => q.q.toLowerCase()));
  const out: Question[] = [];
  for (const r of raw.questions) {
    const q = r.question.trim(), right = r.correct.trim(), why = r.why.trim();
    const wrong = [...new Set(r.wrong.map((w) => w.trim()).filter((w) => w && w.toLowerCase() !== right.toLowerCase()))].slice(0, 3);
    if (!q || !right || !why || wrong.length < 3) continue;
    if (q.length > 400 || why.length > 600 || [right, ...wrong].some((a) => a.length > 160)) continue;
    if (seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    out.push({ q, right, wrong, why });
    if (out.length === COUNT) break;
  }
  return out;
}

async function viaClaude(slug: string): Promise<Question[]> {
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Schema) },
    system: [
      { type: "text", text: TUTOR_RULES },
      { type: "text", text: trackSlugContext(slug), cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: instructions(slug) }],
  });
  if (res.stop_reason === "refusal") throw new RefusedError("declined");
  if (!res.parsed_output) throw new Error(`No parsed output (stop_reason ${res.stop_reason})`);
  return clean(res.parsed_output, slug);
}

async function viaGrok(slug: string): Promise<Question[]> {
  const text = await grokComplete(
    [
      { role: "system", content: `${TUTOR_RULES}\n\n${trackSlugContext(slug)}` },
      { role: "user", content: `${instructions(slug)}\n\nReply with only JSON of this shape and nothing else: {"questions":[{"question":"…","correct":"…","wrong":["…","…","…"],"why":"…"}]}` },
    ],
    6000,
  );
  const json = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "");
  const parsed = Schema.safeParse(JSON.parse(json));
  if (!parsed.success) throw new Error("Grok returned questions in the wrong shape");
  return clean(parsed.data, slug);
}

export async function generateQuestions(slug: string): Promise<{ questions: Question[]; backup: boolean }> {
  try {
    return { questions: await viaClaude(slug), backup: false };
  } catch (err) {
    if (err instanceof RefusedError) throw err;
    if (err instanceof Anthropic.APIError && err.status === 400) throw err;
    console.error("[questions] Claude request failed:", err instanceof Anthropic.APIError ? `HTTP ${err.status}` : (err as Error)?.message);
    if (!grokAvailable()) throw err;
    return { questions: await viaGrok(slug), backup: true };
  }
}
