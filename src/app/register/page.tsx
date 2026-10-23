"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icons";

export default function RegisterPage() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? "Could not register."); setBusy(false); return; }
      const signin = await signIn("credentials", { handle, password, redirect: false });
      setBusy(false);
      if (signin?.error) { setErr("Registered, but sign-in failed. Try the login page."); return; }
      router.push("/challenges"); router.refresh();
    } catch {
      setBusy(false);
      setErr("Network error.");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="eyebrow"><Icon name="shield" />register</div>
      <h1 className="view-title">Pick a handle</h1>
      <p className="lede">No email required. Your handle appears on the scoreboard.</p>
      <form className="auth-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="handle">handle <span style={{ color: "var(--faint)" }}>a–z, 0–9, _ · 3–20</span></label>
          <input id="handle" type="text" value={handle} autoCapitalize="off" spellCheck={false}
            onChange={(e) => setHandle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">password <span style={{ color: "var(--faint)" }}>min 8 chars</span></label>
          <input id="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <div className="auth-err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "…" : "Create handle"}</button>
        <p className="auth-alt">Already registered? <Link href="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
