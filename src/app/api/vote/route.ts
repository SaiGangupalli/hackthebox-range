import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";
import { RULES, take, tooMany } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Rate how hard a challenge was (1 easy … 5 brutal). Only players who solved
// it can vote; voting again changes your vote.
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to vote" }, { status: 401 });
  const limit = take(`write:${uid}`, RULES.write);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await req.json().catch(() => ({}));
  const ch = challenges.find((c) => c.id === body?.challengeId);
  const rating = Number(body?.rating);
  if (!ch) return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });

  try {
    const solved = await prisma.solve.findUnique({ where: { userId_challengeId: { userId: uid, challengeId: ch.id } } });
    if (!solved) return NextResponse.json({ error: "Solve it first, then rate it" }, { status: 403 });
    await prisma.vote.upsert({
      where: { userId_challengeId: { userId: uid, challengeId: ch.id } },
      create: { userId: uid, challengeId: ch.id, rating },
      update: { rating },
    });
    return NextResponse.json({ ok: true, rating });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
