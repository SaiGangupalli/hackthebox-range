import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { take, tooMany } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Change your own password (e.g. after an organizer gave you a temporary one).
export async function POST(req: Request) {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const limit = take(`password:${uid}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!limit.ok) return tooMany(limit.retryAfter, "password attempts");

  const body = await req.json().catch(() => ({}));
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (next.length < 8) return NextResponse.json({ error: "The new password must be at least 8 characters." }, { status: 400 });
  if (next === current) return NextResponse.json({ error: "Choose a password different from the current one." }, { status: 400 });
  try {
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { password: true } });
    if (!user || !(await verifyPassword(current, user.password))) return NextResponse.json({ error: "Your current password is wrong." }, { status: 403 });
    await prisma.user.update({ where: { id: uid }, data: { password: await hashPassword(next) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Database unavailable — your password wasn't changed." }, { status: 503 });
  }
}
