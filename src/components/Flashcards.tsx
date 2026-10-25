"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { cards, decks, type Card } from "@/data/cards";
import { tracks } from "@/data/tracks";
import { grade, preview, countDue, newSeenToday, useReviewState, today, NEW_PER_DAY, type Grade } from "@/lib/review";

const SESSION_MAX = 30;
const GRADES: { g: Grade; label: string; key: string }[] = [
  { g: "again", label: "Again", key: "1" },
  { g: "hard", label: "Hard", key: "2" },
  { g: "good", label: "Good", key: "3" },
  { g: "easy", label: "Easy", key: "4" },
];
const when = (days: number) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

// Spaced-repetition review of glossary terms and quiz questions. Pick a deck
// (or everything due), flip each card, and say how well you knew it.
export function Flashcards() {
  const state = useReviewState();
  const [mounted, setMounted] = useState(false);
  const [deck, setDeck] = useState<string | null>(null); // null = all decks
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, remembered: 0 });
  useEffect(() => setMounted(true), []);

  const inDeck = useCallback((d: string | null) => cards.filter((c) => !d || c.deck === d), []);

  function start(d: string | null) {
    const t = today();
    const pool = inDeck(d);
    const due = pool.filter((c) => state[c.id] && state[c.id].due <= t).sort((a, b) => state[a.id].due - state[b.id].due || state[a.id].box - state[b.id].box);
    const room = Math.max(0, NEW_PER_DAY - newSeenToday(state));
    const fresh = pool.filter((c) => !state[c.id]).slice(0, room);
    setDeck(d);
    setQueue([...due, ...fresh].slice(0, SESSION_MAX));
    setFlipped(false);
    setStats({ reviewed: 0, remembered: 0 });
  }

  const card = queue?.[0] ?? null;

  const answer = useCallback((g: Grade) => {
    if (!card || !flipped) return;
    grade(card.id, g);
    setStats((s) => ({ reviewed: s.reviewed + 1, remembered: s.remembered + (g === "good" || g === "easy" ? 1 : 0) }));
    // "Again" puts the card back at the end of this session for another go.
    setQueue((q) => (q ? [...q.slice(1), ...(g === "again" ? [q[0]] : [])] : q));
    setFlipped(false);
  }, [card, flipped]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if ((e.key === " " || e.key === "Enter") && !flipped) { e.preventDefault(); setFlipped(true); return; }
      const hit = GRADES.find((x) => x.key === e.key);
      if (hit && flipped) { e.preventDefault(); answer(hit.g); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, answer]);

  const total = useMemo(() => countDue(cards.map((c) => c.id), state), [state]);
  if (!mounted) return null;

  // ── In a session ──────────────────────────────────────────────────────────
  if (queue) {
    if (!card) {
      return (
        <div className="fc-done">
          <Icon name="trophy" />
          <h2>Session complete</h2>
          <p>You reviewed <b>{stats.reviewed}</b> card{stats.reviewed === 1 ? "" : "s"} and remembered <b>{stats.remembered}</b> on the first try or after another look. Cards you knew come back later; ones you missed come back sooner.</p>
          <div className="fc-done-actions">
            <button className="btn primary" onClick={() => start(deck)}>Review more in this deck</button>
            <button className="btn" onClick={() => setQueue(null)}>Choose another deck</button>
          </div>
        </div>
      );
    }
    const prev = state[card.id];
    const next = preview(prev);
    return (
      <div className="fc-session">
        <div className="fc-top">
          <button className="task-hintbtn" onClick={() => setQueue(null)}>← all decks</button>
          <span>{deck ?? "All decks"} · {queue.length} left · {stats.reviewed} done</span>
        </div>
        <div className={`fc-card${flipped ? " flipped" : ""}`} aria-live="polite">
          <div className="fc-meta">
            <span className="chip">{card.deck}</span>
            <span>{prev ? `box ${prev.box} of 5` : "new card"}</span>
          </div>
          <div className="fc-front"><InlineCode text={card.front} /></div>
          {flipped ? (
            <div className="fc-back">
              <p className="fc-answer"><InlineCode text={card.back} /></p>
              {card.extra && <p className="fc-extra"><b>{card.kind === "term" ? "Example" : "Why"}</b> <InlineCode text={card.extra} /></p>}
              {card.track && tracks[card.track] && <Link className="fc-track" href={`/tracks/${card.track}`}>Revisit the {tracks[card.track].title} track →</Link>}
            </div>
          ) : (
            <button className="btn primary fc-flip" onClick={() => setFlipped(true)}>Show answer <kbd>Space</kbd></button>
          )}
        </div>
        {flipped && (
          <div className="fc-grades" role="group" aria-label="How well did you know it?">
            {GRADES.map(({ g, label, key }) => (
              <button key={g} className={`fc-grade ${g}`} onClick={() => answer(g)}>
                <b>{label}</b><small>{when(next[g])}</small><kbd>{key}</kbd>
              </button>
            ))}
          </div>
        )}
        <p className="fc-help">Say honestly how well you knew it — that&apos;s what decides when you see it again.</p>
      </div>
    );
  }

  // ── Deck picker ───────────────────────────────────────────────────────────
  const ready = total.due + total.fresh;
  return (
    <>
      <div className="fc-stats">
        <div><b>{total.due}</b><span>reviews due today</span></div>
        <div><b>{total.fresh}</b><span>new cards today (max {NEW_PER_DAY})</span></div>
        <div><b>{total.learned}<i>/{cards.length}</i></b><span>cards learned</span></div>
      </div>
      <button className="btn primary fc-start" disabled={!ready} onClick={() => start(null)}>
        <Icon name="zap" />{ready ? `Review everything due (${Math.min(ready, SESSION_MAX)})` : "All caught up for today"}
      </button>
      <div className="fc-decks">
        {decks.map((d) => {
          const c = countDue(inDeck(d.name).map((x) => x.id), state);
          const n = c.due + c.fresh;
          return (
            <button key={d.name} className="fc-deck" onClick={() => start(d.name)} disabled={!n}>
              <span className="fc-deck-kind">{d.kind === "term" ? "glossary" : d.kind === "question" ? "quiz" : "glossary + quiz"}</span>
              <b>{d.name}</b>
              <small>{d.count} cards · {c.learned} learned</small>
              <span className="mini-bar wide"><i style={{ width: `${(c.learned / d.count) * 100}%` }} /></span>
              <span className="fc-deck-go">{n ? `${c.due} due · ${c.fresh} new →` : "nothing due"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
