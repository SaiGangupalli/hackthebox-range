import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in to submit flags" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ch = challenges.find((c) => c.id === body?.challengeId);
  if (!ch) return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });

  const submitted = String(body?.flag ?? "").trim();
  const hash = createHash("sha256").update(submitted).digest("hex");
  if (hash !== ch.flagHash) return NextResponse.json({ correct: false });

  try {
    await prisma.solve.create({ data: { userId: uid, challengeId: ch.id, points: ch.points } });
    return NextResponse.json({ correct: true, points: ch.points });
  } catch {
    // Unique constraint (already solved) or DB error — either way the flag was right.
    return NextResponse.json({ correct: true, already: true, points: ch.points });
  }
}
