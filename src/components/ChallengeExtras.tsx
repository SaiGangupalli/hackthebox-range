"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

// Paid hint: first click asks for confirmation (so points aren't spent by
// accident), the second opens it. The page then re-renders with the hint text
// and your updated score.
export function HintButton({ challengeId, index, cost, free }: { challengeId: string; index: number; cost: number; free: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const price = free ? "free — you've solved it" : `costs ${cost} pts`;

  async function open() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, hint: index }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Couldn't open the hint.");
      else router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div className="hint-lock">
      <Icon name="crypto" />
      <span>Extra hint {index + 1} · {price}</span>
      {!confirm ? (
        <button className="task-hintbtn" onClick={() => (free ? open() : setConfirm(true))} disabled={busy}>Open hint</button>
      ) : (
        <span className="hint-confirm">
          <button className="btn primary" onClick={open} disabled={busy}>{busy ? "…" : `Spend ${cost} pts`}</button>
          <button className="task-hintbtn" onClick={() => setConfirm(false)}>Cancel</button>
        </span>
      )}
      {err && <span className="hint-err">{err}</span>}
    </div>
  );
}

const LABELS = ["", "easy", "fair", "tricky", "hard", "brutal"];

// Difficulty vote, for players who solved the challenge.
export function VoteControl({ challengeId, current }: { challengeId: string; current: number | null }) {
  const router = useRouter();
  const [mine, setMine] = useState(current);
  const [busy, setBusy] = useState(false);

  async function vote(rating: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, rating }) });
      if (res.ok) { setMine(rating); router.refresh(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vote">
      <span>How hard was it?</span>
      <div className="vote-btns" role="group" aria-label="Rate difficulty">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`vote-btn${mine === n ? " on" : ""}`} disabled={busy} onClick={() => vote(n)} title={LABELS[n]}>
            {n}
          </button>
        ))}
      </div>
      <small>{mine ? `you said: ${LABELS[mine]}` : "1 easy · 5 brutal"}</small>
    </div>
  );
}
