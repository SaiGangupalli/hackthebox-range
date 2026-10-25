import { NextResponse } from "next/server";
import { getEvent } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The event state and times (public: the same thing the banner shows). Open
// pages poll it so an organizer's change in /admin reaches everyone.
export async function GET() {
  return NextResponse.json(await getEvent());
}
