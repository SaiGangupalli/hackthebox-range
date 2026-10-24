import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildPrompt, cleanHistory, streamTutor, type Ask } from "@/lib/ai/tutor";
import { takeToken } from "@/lib/ai/limits";
import { grokAvailable } from "@/lib/ai/grok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AI tutor: streams a plain-text (Markdown) answer. Signed-in players only, with
// an hourly limit per player. Body: { ask: Ask, history?: Turn[], page?: string }.
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to use the AI tutor." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY && !grokAvailable()) {
    return NextResponse.json({ error: "The AI tutor isn't configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const built = buildPrompt(body?.ask as Ask);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const limit = takeToken("tutor", uid);
  if (!limit.ok) {
    return NextResponse.json({ error: `You've reached the tutor's hourly limit. Try again in about ${limit.retryMin} min.` }, { status: 429 });
  }

  const stream = streamTutor({
    prompt: built.prompt,
    history: cleanHistory(body?.history),
    page: typeof body?.page === "string" ? body.page.slice(0, 100) : undefined,
    signal: req.signal,
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Tutor-Left": String(limit.left) },
  });
}
