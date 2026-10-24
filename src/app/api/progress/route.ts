import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { labById } from "@/data/labs";
import { quiz } from "@/data/quiz";
import { pathOrder } from "@/data/path";

export const runtime = "nodejs";

// Learning progress for the signed-in player. GET returns everything saved;
// POST merges a batch: lab objectives are OR-ed (never lost), quizzes keep the
// best score, tracks take the latest done/undone. Unknown keys are ignored.

type Item = { kind: "lab" | "quiz" | "track"; key: string; data: unknown };

async function uid() {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

function normalise(item: Item, existing: unknown): unknown | null {
  if (item.kind === "lab") {
    const lab = labById[item.key];
    if (!lab || !Array.isArray(item.data)) return null;
    const prev = Array.isArray(existing) ? existing : [];
    return Array.from({ length: lab.objectives }, (_, i) => Boolean(item.data && (item.data as unknown[])[i]) || Boolean(prev[i]));
  }
  if (item.kind === "quiz") {
    const qs = quiz[item.key];
    const best = (item.data as { best?: unknown })?.best;
    if (!qs || typeof best !== "number") return null;
    const prevBest = typeof (existing as { best?: unknown })?.best === "number" ? (existing as { best: number }).best : 0;
    return { best: Math.max(prevBest, Math.max(0, Math.min(qs.length, Math.floor(best)))), total: qs.length };
  }
  if (item.kind === "track") {
    if (!pathOrder.includes(item.key)) return null;
    return { done: (item.data as { done?: unknown })?.done === true };
  }
  return null;
}

export async function GET() {
  const id = await uid();
  if (!id) return NextResponse.json({ error: "Sign in to sync progress" }, { status: 401 });
  try {
    const rows = await prisma.progress.findMany({ where: { userId: id }, select: { kind: true, key: true, data: true } });
    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const id = await uid();
  if (!id) return NextResponse.json({ error: "Sign in to sync progress" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const items: Item[] = Array.isArray(body?.items) ? body.items.slice(0, 60) : [];
  const valid = items.filter((it) => it && ["lab", "quiz", "track"].includes(it.kind) && typeof it.key === "string" && /^[a-z0-9-]{1,40}$/.test(it.key));
  try {
    const existing = await prisma.progress.findMany({
      where: { userId: id, OR: valid.map((it) => ({ kind: it.kind, key: it.key })) },
      select: { kind: true, key: true, data: true },
    });
    const prev = new Map(existing.map((r) => [`${r.kind}:${r.key}`, r.data]));
    const saved: { kind: string; key: string; data: unknown }[] = [];
    for (const it of valid) {
      const data = normalise(it, prev.get(`${it.kind}:${it.key}`));
      if (data === null) continue;
      await prisma.progress.upsert({
        where: { userId_kind_key: { userId: id, kind: it.kind, key: it.key } },
        create: { userId: id, kind: it.kind, key: it.key, data: data as object },
        update: { data: data as object },
      });
      saved.push({ kind: it.kind, key: it.key, data });
    }
    return NextResponse.json({ ok: true, items: saved });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
