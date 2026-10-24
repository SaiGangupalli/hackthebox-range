import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { tracks } from "@/data/tracks";
import { generateQuestions, RefusedError } from "@/lib/ai/questions";
import { takeToken } from "@/lib/ai/limits";
import { grokAvailable } from "@/lib/ai/grok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Fresh AI-written practice questions for a track. Body: { track: slug }.
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to generate practice questions." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY && !grokAvailable()) {
    return NextResponse.json({ error: "AI question generation isn't configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const slug = String(body?.track ?? "");
  if (!tracks[slug]) return NextResponse.json({ error: "Unknown track." }, { status: 400 });

  const limit = takeToken("questions", uid);
  if (!limit.ok) return NextResponse.json({ error: `You've generated a lot of rounds this hour. Try again in about ${limit.retryMin} min.` }, { status: 429 });

  try {
    const { questions, backup } = await generateQuestions(slug);
    if (!questions.length) return NextResponse.json({ error: "Couldn't generate usable questions this time — please try again." }, { status: 502 });
    return NextResponse.json({ questions, backup, left: limit.left });
  } catch (err) {
    if (err instanceof RefusedError) return NextResponse.json({ error: "The model declined to write questions for this one. Try another track." }, { status: 422 });
    return NextResponse.json({ error: "Question generation is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
