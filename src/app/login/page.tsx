"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await signIn("credentials", { handle, password, redirect: false });
    setBusy(false);
    if (res?.error) setErr("Invalid handle or password.");
    else { router.push("/challenges"); router.refresh(); }
  }

  return (
    <div className="auth-wrap">
      <div className="eyebrow"><Icon name="shield" />sign in</div>
      <h1 className="view-title">Welcome back</h1>
      <p className="lede">Sign in to submit flags and climb the scoreboard.</p>
      <form className="auth-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="handle">handle</label>
          <input id="handle" type="text" value={handle} autoCapitalize="off" spellCheck={false}
            onChange={(e) => setHandle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">password</label>
          <input id="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <div className="auth-err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "…" : "Sign in"}</button>
        <p className="auth-alt">New here? <Link href="/register">Create a handle</Link></p>
      </form>
    </div>
  );
}
