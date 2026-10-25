import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { RULES, take, clientIp, tooMany } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = take(`register:${clientIp(req)}`, RULES.registerPerIp);
  if (!limit.ok) return tooMany(limit.retryAfter, "sign-ups from this network");
  const body = await req.json().catch(() => ({}));
  const handle = String(body?.handle ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    return NextResponse.json({ error: "Handle must be 3–20 chars: a–z, 0–9, _" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { handle } });
    if (existing) return NextResponse.json({ error: "That handle is taken" }, { status: 409 });
    await prisma.user.create({ data: { handle, password: await hashPassword(password) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Database unavailable — is DATABASE_URL set and migrated?" }, { status: 503 });
  }
}
