"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import type { FeedItem } from "@/lib/stats";

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// "Who's doing what" — recent solves, finished tracks and team joins.
// Refreshes every 30 seconds; stays quiet if the database isn't connected.
export function ActivityFeed({ limit = 12 }: { limit?: number }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/feed")
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setItems(d.items ?? []); setNow(Date.now()); } })
        .catch(() => { if (!cancelled) setItems([]); });
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000); // background tabs don't poll
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (items === null) return <div className="feed-skel" aria-hidden="true" />;
  if (!items.length) return <p className="feed-empty">Nothing yet — be the first: finish a track or solve a challenge.</p>;

  return (
    <ul className="feed" aria-live="polite">
      {items.slice(0, limit).map((it, i) => (
        <li key={`${it.type}-${it.handle}-${it.at}-${i}`} className={it.type === "solve" && it.firstBlood ? "fb" : ""}>
          <span className={`feed-ic ${it.type}`}><Icon name={it.type === "solve" ? (it.firstBlood ? "trophy" : "flag") : it.type === "track" ? "book" : "network"} /></span>
          <span className="feed-text">
            <Link href={`/u/${it.handle}`}>{it.handle}</Link>
            {it.type === "solve" && <> solved <b>{it.title}</b> <span className="feed-pts">+{it.points}</span>{it.firstBlood && <span className="feed-fb">first blood</span>}</>}
            {it.type === "track" && <> completed the <b>{it.title}</b> track</>}
            {it.type === "team" && <> joined team <b>{it.team}</b></>}
          </span>
          <span className="feed-ago">{ago(it.at, now)}</span>
        </li>
      ))}
    </ul>
  );
}
