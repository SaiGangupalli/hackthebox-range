import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { submitExam } from "@/lib/certify/exam";
import { RULES, take, tooMany } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Submit answers for the exam in progress. Body: { cert: id, answers: { [questionId]: optionText } }.
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to submit an exam." }, { status: 401 });
  const limit = take(`write:${uid}`, RULES.write);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const body = await req.json().catch(() => ({}));
  const cert = String(body?.cert ?? "");
  const answers = body?.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? (body.answers as Record<string, unknown>) : {};
  try {
    const r = await submitExam(uid, cert, answers);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "Database unavailable — your answers weren't recorded. Please try again." }, { status: 503 });
  }
}
