"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/icons";

// Your account: change your password (for example after an organizer reset it).
export default function AccountPage() {
  const { data: session, status } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) { setMsg({ ok: false, text: "The two new passwords don't match." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Couldn't change your password." });
      else { setMsg({ ok: true, text: "Password changed. Use the new one next time you sign in." }); setCurrent(""); setNext(""); setAgain(""); }
    } catch {
      setMsg({ ok: false, text: "Network error — your password wasn't changed." });
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;
  if (!session?.user) {
    return (
      <div className="auth-wrap">
        <h1 className="view-title">Your account</h1>
        <p className="lede"><Link href="/login">Sign in</Link> to manage your account.</p>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="eyebrow"><Icon name="wrench" />account</div>
      <h1 className="view-title">{session.user.name}</h1>
      <p className="lede">Change your password here — for example after an organizer gave you a temporary one. <Link href={`/u/${session.user.name}`}>View your profile →</Link></p>
      <form className="auth-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="current">current password</label>
          <input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="next">new password (8+ characters)</label>
          <input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="again">new password again</label>
          <input id="again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
        {msg && <div className={msg.ok ? "auth-ok" : "auth-err"}>{msg.text}</div>}
        <button className="btn primary" type="submit" disabled={busy || !current || !next}>{busy ? "…" : "Change password"}</button>
        <p className="auth-alt">Forgot your current password? Ask an organizer at the help desk to reset it.</p>
      </form>
    </div>
  );
}
