import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";
import { RULES, take, tooMany } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Open a paid hint. Its cost comes off your score once (re-opening is free),
// and hints opened after you've solved the challenge cost nothing.
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to use hints" }, { status: 401 });
  const limit = take(`write:${uid}`, RULES.write);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await req.json().catch(() => ({}));
  const ch = challenges.find((c) => c.id === body?.challengeId);
  const i = Number(body?.hint);
  const hint = ch?.hints?.[i];
  if (!ch || !Number.isInteger(i) || !hint) return NextResponse.json({ error: "Unknown hint" }, { status: 404 });

  try {
    const solved = await prisma.solve.findUnique({ where: { userId_challengeId: { userId: uid, challengeId: ch.id } } });
    const unlock = await prisma.hintUnlock.upsert({
      where: { userId_challengeId_hint: { userId: uid, challengeId: ch.id, hint: i } },
      create: { userId: uid, challengeId: ch.id, hint: i, cost: solved ? 0 : hint.cost },
      update: {},
    });
    return NextResponse.json({ text: hint.text, cost: unlock.cost });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
