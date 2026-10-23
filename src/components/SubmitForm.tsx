"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = { kind: "ok" | "already" | "wrong" | "err"; msg: string } | null;

export function SubmitForm({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [flag, setFlag] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!flag.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, flag }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setResult({ kind: "err", msg: "Sign in to submit flags." });
      } else if (data.correct && data.already) {
        setResult({ kind: "already", msg: "Correct — already solved." });
      } else if (data.correct) {
        setResult({ kind: "ok", msg: `Correct! +${data.points} points` });
        setFlag("");
        router.refresh();
      } else {
        setResult({ kind: "wrong", msg: "Not quite — try again." });
      }
    } catch {
      setResult({ kind: "err", msg: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="submit-row" onSubmit={submit}>
      <input
        type="text"
        value={flag}
        onChange={(e) => setFlag(e.target.value)}
        placeholder="HHB{…}"
        aria-label="flag"
        spellCheck={false}
        autoCapitalize="off"
      />
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "…" : "Submit"}</button>
      {result && <span className={`submit-msg ${result.kind}`}>{result.msg}</span>}
    </form>
  );
}
