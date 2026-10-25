"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import type { EventInfo } from "@/lib/event";

function left(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

const at = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const POLL_MS = 30_000;
const same = (a: EventInfo, b: EventInfo) => a.state === b.state && a.start === b.start && a.end === b.end && a.freeze === b.freeze;

// Live countdown for event mode (see src/lib/event.ts). Refreshes the page when
// the event changes state, or when an organizer changes the times, so submit
// boxes and the scoreboard update. Practice mode (no event times) renders nothing.
export function EventBanner({ event }: { event: EventInfo }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      fetch("/api/event").then((r) => (r.ok ? r.json() : null)).then((e: EventInfo | null) => { if (e && !same(e, event)) router.refresh(); }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [event, router]);

  const next = event.state === "before" ? event.start : event.state === "live" ? event.freeze ?? event.end : event.state === "frozen" ? event.end : null;
  useEffect(() => {
    if (now !== null && next && now >= new Date(next).getTime()) router.refresh();
  }, [now, next, router]);

  if (event.state === "practice") return null;
  const until = (iso: string | null) => (iso && now !== null ? left(new Date(iso).getTime() - now) : "…");

  const content = {
    before: { cls: "info", icon: "flag", title: "The event hasn't started yet", text: `Starts in ${until(event.start)}${event.start && now !== null ? ` — ${at(event.start)}` : ""}. Read the challenges and warm up in the tracks meanwhile.` },
    live: { cls: "live", icon: "zap", title: "Event live", text: event.freeze ? `Scoreboard freezes in ${until(event.freeze)}, event ends in ${until(event.end)}.` : `Ends in ${until(event.end)}.` },
    frozen: { cls: "warn", icon: "shield", title: "Scoreboard frozen", text: `You can still submit flags. Final results appear when the event ends in ${until(event.end)}.` },
    ended: { cls: "info", icon: "trophy", title: "Event over", text: "Submissions are closed. These are the final results." },
  }[event.state];

  return (
    <div className={`event-banner ${content.cls}`} role="status">
      <Icon name={content.icon} />
      <div><b>{content.title}</b><span>{content.text}</span></div>
    </div>
  );
}
