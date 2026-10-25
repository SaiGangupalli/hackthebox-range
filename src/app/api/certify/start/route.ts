import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { startExam } from "@/lib/certify/exam";
import { RULES, take, tooMany } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Start (or resume) a Range certification exam. Body: { cert: id }.
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to take a certification exam." }, { status: 401 });
  const limit = take(`write:${uid}`, RULES.write);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const body = await req.json().catch(() => ({}));
  const cert = String(body?.cert ?? "");
  try {
    const r = await startExam(uid, cert);
    if (!r.ok) return NextResponse.json({ error: r.error, retryAt: r.retryAt ?? null }, { status: r.status });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "Database unavailable — please try again shortly." }, { status: 503 });
  }
}
