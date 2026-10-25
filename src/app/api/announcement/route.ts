import { NextResponse } from "next/server";
import { siteOrDefault } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The organizers' site-wide announcement (or null), polled by every page.
export async function GET() {
  const { announcement } = await siteOrDefault();
  return NextResponse.json({ announcement: announcement ? { text: announcement.text, level: announcement.level, at: announcement.at } : null });
}
