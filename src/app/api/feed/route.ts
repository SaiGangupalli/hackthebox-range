import { NextResponse } from "next/server";
import { getFeed } from "@/lib/stats";
import { eventInfo, boardCutoff } from "@/lib/event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public activity feed (solves, finished tracks, team joins). Respects the
// scoreboard freeze so late solves don't leak.
export async function GET() {
  try {
    return NextResponse.json({ items: await getFeed(boardCutoff(eventInfo())) });
  } catch {
    return NextResponse.json({ items: [], error: "Database unavailable" }, { status: 503 });
  }
}
