import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProfile } from "@/lib/stats";

export const runtime = "nodejs";

// The signed-in player's rank summary, for the header chip.
export async function GET() {
  const handle = (await auth())?.user?.name;
  if (!handle) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const p = await getProfile(handle);
    if (!p) return NextResponse.json({ error: "Unknown player" }, { status: 404 });
    return NextResponse.json({ handle: p.handle, rank: p.rank.name, level: p.rank.level, xp: p.rank.xp, points: p.score.points });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
