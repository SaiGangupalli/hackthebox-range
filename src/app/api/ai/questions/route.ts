import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { tracks } from "@/data/tracks";
import { industryCertById } from "@/data/industryCerts";
import { generateQuiz, generateCertQuestions, RefusedError, QUIZ_LEVELS, type QuizLevel } from "@/lib/ai/questions";
import { verifiedQuestion } from "@/lib/ai/signed";
import { takeToken } from "@/lib/ai/limits";
import { grokAvailable } from "@/lib/ai/grok";
import type { Question } from "@/data/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Questions sent back from an earlier round must carry the server's signature.
const signed = (x: unknown, max: number): Question[] =>
  (Array.isArray(x) ? x.slice(0, max) : []).map(verifiedQuestion).filter((q): q is Question => q !== null);

// Fresh AI-written practice questions. Body:
//   { tracks: slug[], level?, count?: 5 | 10, focus?, avoid?: Question[], review?: Question[] }
//     a quiz round on one or more tracks; avoid = the last round (don't repeat),
//     review = questions the learner missed (re-test the same ideas)
//   { track: slug }  the same, for one track (older clients)
//   { cert: id }     the topics of a real-world certification (/certifications)
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to generate practice questions." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY && !grokAvailable()) {
    return NextResponse.json({ error: "AI question generation isn't configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const cert = String(body?.cert ?? "");
  const asked = Array.isArray(body?.tracks) ? body.tracks : body?.track ? [body.track] : [];
  const slugs = [...new Set<string>(asked.map(String))];
  if (!industryCertById[cert] && (!slugs.length || !slugs.every((s) => tracks[s]))) {
    return NextResponse.json({ error: "Unknown track or certification." }, { status: 400 });
  }
  const level: QuizLevel = QUIZ_LEVELS.includes(body?.level) ? body.level : "auto";
  const count = body?.count === 10 ? 10 : 5;
  const focus = String(body?.focus ?? "").replace(/[\u0000-\u001f"<>`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  const limit = takeToken("questions", uid);
  if (!limit.ok) return NextResponse.json({ error: `You've generated a lot of rounds this hour. Try again in about ${limit.retryMin} min.` }, { status: 429 });

  try {
    const { questions, backup } = industryCertById[cert]
      ? await generateCertQuestions(cert)
      : await generateQuiz({ slugs, level, count, focus, avoid: signed(body?.avoid, 20), review: signed(body?.review, 10) });
    if (!questions.length) return NextResponse.json({ error: "Couldn't generate usable questions this time — please try again." }, { status: 502 });
    return NextResponse.json({ questions, backup, left: limit.left });
  } catch (err) {
    if (err instanceof RefusedError) return NextResponse.json({ error: "The model declined to write questions for this one. Try another topic." }, { status: 422 });
    return NextResponse.json({ error: "Question generation is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
