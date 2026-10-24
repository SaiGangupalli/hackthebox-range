import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";
import { eventInfo, acceptsFlags } from "@/lib/event";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to submit flags" }, { status: 401 });

  const ev = eventInfo();
  if (!acceptsFlags(ev)) {
    const msg = ev.state === "before" ? "The event hasn't started yet." : "The event has ended — submissions are closed.";
    return NextResponse.json({ error: msg, event: ev.state }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ch = challenges.find((c) => c.id === body?.challengeId);
  if (!ch) return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });

  const submitted = String(body?.flag ?? "").trim();
  const hash = createHash("sha256").update(submitted).digest("hex");
  if (hash !== ch.flagHash) return NextResponse.json({ correct: false });

  try {
    const existing = await prisma.solve.findUnique({ where: { userId_challengeId: { userId: uid, challengeId: ch.id } } });
    if (existing) return NextResponse.json({ correct: true, already: true, points: ch.points });
    const first = (await prisma.solve.count({ where: { challengeId: ch.id } })) === 0;
    await prisma.solve.create({ data: { userId: uid, challengeId: ch.id, points: ch.points } });
    return NextResponse.json({ correct: true, points: ch.points, firstBlood: first });
  } catch {
    // A unique-constraint race means a parallel request already recorded it.
    const again = await prisma.solve.findUnique({ where: { userId_challengeId: { userId: uid, challengeId: ch.id } } }).catch(() => null);
    if (again) return NextResponse.json({ correct: true, already: true, points: ch.points });
    return NextResponse.json({ error: "Correct flag, but the database is unavailable — try again in a moment." }, { status: 503 });
  }
}
