import { NextResponse } from "next/server";
import { getFeed } from "@/lib/stats";
import { boardCutoff } from "@/lib/event";
import { getEvent } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public activity feed (solves, finished tracks, team joins). Respects the
// scoreboard freeze so late solves don't leak.
export async function GET() {
  try {
    return NextResponse.json({ items: await getFeed(boardCutoff(await getEvent())) });
  } catch {
    return NextResponse.json({ items: [], error: "Database unavailable" }, { status: 503 });
  }
}
