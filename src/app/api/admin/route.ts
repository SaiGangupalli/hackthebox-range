import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { challenges } from "@/data/challenges";
import { currentAdmin, isAdminHandle } from "@/lib/admin";
import { getSite, setAnnouncement, setEventTimes, setHidden, setBanned, audit } from "@/lib/settings";
import { timesProblem, type EventTimes } from "@/lib/event";
import { reset } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READABLE = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
// Three groups of four (e.g. "k7mp-2xqa-9fhw"): 12 random characters, easy to read out.
const tempPassword = () => Array.from({ length: 14 }, (_, i) => (i === 4 || i === 9 ? "-" : READABLE[randomInt(READABLE.length)])).join("");

const isoOrNull = (v: unknown) => {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "invalid" : d.toISOString();
};
const short = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") + " UTC" : "—");

// Organizer actions. Body: { action, ... }. Every change is written to the
// audit log; temporary passwords are returned once and never logged.
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  try {
    if (action === "announce") {
      const text = String(body?.text ?? "").trim().replace(/\s+/g, " ");
      if (!text || text.length > 280) return NextResponse.json({ error: "Write 1–280 characters." }, { status: 400 });
      const level = body?.level === "warn" ? "warn" : "info";
      await setAnnouncement({ text, level, at: new Date().toISOString(), by: admin.handle });
      await audit(admin.handle, "posted announcement", text.slice(0, 80));
      return NextResponse.json({ ok: true });
    }
    if (action === "clear-announcement") {
      await setAnnouncement(null);
      await audit(admin.handle, "cleared announcement");
      return NextResponse.json({ ok: true });
    }

    // Event times: { start, end, freeze } as ISO strings or null. All null is
    // practice mode; "event-clear" goes back to the EVENT_* env vars.
    if (action === "event-set") {
      const t: EventTimes = { start: isoOrNull(body?.start), end: isoOrNull(body?.end), freeze: isoOrNull(body?.freeze) };
      const problem = timesProblem(t);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      await setEventTimes(t);
      await audit(admin.handle, "set event times", `start ${short(t.start)} · freeze ${short(t.freeze)} · end ${short(t.end)}`);
      return NextResponse.json({ ok: true });
    }
    if (action === "event-clear") {
      await setEventTimes(null);
      await audit(admin.handle, "reset event times to the .env values");
      return NextResponse.json({ ok: true });
    }

    if (action === "hide" || action === "show") {
      const id = String(body?.challengeId ?? "");
      if (!challenges.some((c) => c.id === id)) return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
      const { hidden } = await getSite();
      await setHidden(action === "hide" ? [...hidden, id] : hidden.filter((h) => h !== id));
      await audit(admin.handle, action === "hide" ? "hid challenge" : "showed challenge", id);
      return NextResponse.json({ ok: true });
    }

    const handle = String(body?.handle ?? "").trim().toLowerCase();
    const user = handle ? await prisma.user.findUnique({ where: { handle }, select: { id: true, handle: true } }) : null;

    if (action === "ban" || action === "unban") {
      if (!user) return NextResponse.json({ error: "No player with that handle" }, { status: 404 });
      if (action === "ban" && (user.id === admin.id || isAdminHandle(user.handle))) return NextResponse.json({ error: "Organizers can't be banned here — remove them from ADMIN_HANDLES first." }, { status: 400 });
      const { banned } = await getSite();
      await setBanned(action === "ban" ? [...banned, user.id] : banned.filter((b) => b !== user.id));
      await audit(admin.handle, action === "ban" ? "banned player" : "unbanned player", user.handle);
      return NextResponse.json({ ok: true });
    }

    if (action === "reset-password") {
      if (!user) return NextResponse.json({ error: "No player with that handle" }, { status: 404 });
      const password = tempPassword();
      await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
      reset(`login-fail:${user.handle}`);
      await audit(admin.handle, "reset password", user.handle);
      return NextResponse.json({ ok: true, handle: user.handle, password });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Database unavailable — nothing was changed." }, { status: 503 });
  }
}
