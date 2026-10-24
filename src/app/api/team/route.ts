import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Teams: create one (you get a join code to share), join with a code, or leave.
// One team per player; TEAM_MAX (default 4) caps the size; an empty team is
// deleted when its last member leaves.
const TEAM_MAX = Math.max(1, parseInt(process.env.TEAM_MAX ?? "4", 10) || 4);
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads

const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

async function uid() {
  return ((await auth())?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const id = await uid();
  if (!id) return NextResponse.json({ error: "Sign in to see your team" }, { status: 401 });
  const m = await prisma.teamMember.findUnique({
    where: { userId: id },
    select: { team: { select: { name: true, code: true, members: { select: { joinedAt: true, user: { select: { handle: true } } }, orderBy: { joinedAt: "asc" } } } } },
  });
  return NextResponse.json({ team: m ? { name: m.team.name, code: m.team.code, members: m.team.members.map((x) => x.user.handle), max: TEAM_MAX } : null });
}

export async function POST(req: Request) {
  const id = await uid();
  if (!id) return NextResponse.json({ error: "Sign in to manage teams" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  try {
    const current = await prisma.teamMember.findUnique({ where: { userId: id } });

    if (action === "create") {
      const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
      if (!/^[A-Za-z0-9 _-]{3,24}$/.test(name)) return NextResponse.json({ error: "Team name: 3–24 characters — letters, numbers, spaces, _ or -" }, { status: 400 });
      if (current) return NextResponse.json({ error: "Leave your current team first" }, { status: 409 });
      const clash = await prisma.team.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (clash) return NextResponse.json({ error: "That team name is taken" }, { status: 409 });
      const team = await prisma.team.create({ data: { name, code: newCode(), members: { create: { userId: id } } } });
      return NextResponse.json({ ok: true, name: team.name, code: team.code });
    }

    if (action === "join") {
      const code = String(body?.code ?? "").trim().toUpperCase();
      if (current) return NextResponse.json({ error: "Leave your current team first" }, { status: 409 });
      const team = await prisma.team.findUnique({ where: { code }, select: { id: true, name: true, _count: { select: { members: true } } } });
      if (!team) return NextResponse.json({ error: "No team has that code — check it with your captain" }, { status: 404 });
      if (team._count.members >= TEAM_MAX) return NextResponse.json({ error: `That team is full (max ${TEAM_MAX})` }, { status: 409 });
      await prisma.teamMember.create({ data: { userId: id, teamId: team.id } });
      return NextResponse.json({ ok: true, name: team.name });
    }

    if (action === "leave") {
      if (!current) return NextResponse.json({ error: "You're not in a team" }, { status: 400 });
      await prisma.teamMember.delete({ where: { userId: id } });
      const left = await prisma.teamMember.count({ where: { teamId: current.teamId } });
      if (left === 0) await prisma.team.delete({ where: { id: current.teamId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Database unavailable — try again" }, { status: 503 });
  }
}
