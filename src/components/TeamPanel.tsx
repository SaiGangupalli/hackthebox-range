"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "./icons";
import { copyText } from "@/lib/toast";

type Team = { name: string; code: string; members: string[]; max: number } | null;

// Create, join or leave a team. Talks to /api/team.
export function TeamPanel() {
  const { status } = useSession();
  const [team, setTeam] = useState<Team | undefined>(undefined);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function load() {
    const res = await fetch("/api/team").catch(() => null);
    const data = res && res.ok ? await res.json() : { team: null };
    setTeam(data.team);
  }
  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  async function act(body: Record<string, string>) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Something went wrong.");
      else { setName(""); setCode(""); setConfirmLeave(false); await load(); }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || (status === "authenticated" && team === undefined)) return <div className="team-skel" aria-hidden="true" />;

  if (status !== "authenticated") {
    return (
      <div className="callout warn">
        <Icon name="shield" />
        <div><Link href="/login">Sign in</Link> or <Link href="/register">create a handle</Link> to create or join a team.</div>
      </div>
    );
  }

  if (team) {
    return (
      <div className="team-card">
        <div className="team-top">
          <div>
            <span className="team-label">your team</span>
            <h2>{team.name}</h2>
          </div>
          <span className="team-size">{team.members.length}/{team.max} members</span>
        </div>
        <div className="team-code">
          <span>Join code</span>
          <button className="team-code-v" onClick={() => copyText(team.code)} title="Click to copy">{team.code}</button>
          <small>Share it with teammates — they enter it below on their own account.</small>
        </div>
        <ul className="team-members">
          {team.members.map((m) => <li key={m}><Link href={`/u/${m}`}>{m}</Link></li>)}
        </ul>
        {err && <div className="auth-err">{err}</div>}
        {!confirmLeave ? (
          <button className="btn" onClick={() => setConfirmLeave(true)}>Leave team</button>
        ) : (
          <div className="team-leave">
            <span>{team.members.length === 1 ? "You're the last member — leaving deletes the team." : "Leave this team?"}</span>
            <button className="btn primary" disabled={busy} onClick={() => act({ action: "leave" })}>{busy ? "…" : "Yes, leave"}</button>
            <button className="task-hintbtn" onClick={() => setConfirmLeave(false)}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {err && <div className="auth-err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="team-choose">
        <form className="team-card" onSubmit={(e) => { e.preventDefault(); act({ action: "create", name }); }}>
          <span className="team-label">start a team</span>
          <h2>Create a team</h2>
          <p>You get a join code to share. 3–24 characters: letters, numbers, spaces, _ or -.</p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" aria-label="Team name" maxLength={24} />
          <button className="btn primary" type="submit" disabled={busy || name.trim().length < 3}>Create team</button>
        </form>
        <form className="team-card" onSubmit={(e) => { e.preventDefault(); act({ action: "join", code }); }}>
          <span className="team-label">have a code?</span>
          <h2>Join a team</h2>
          <p>Ask a teammate for the 8-character join code shown on their Teams page.</p>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. K7M2QX9P" aria-label="Join code" maxLength={8} spellCheck={false} autoCapitalize="characters" />
          <button className="btn primary" type="submit" disabled={busy || code.trim().length !== 8}>Join team</button>
        </form>
      </div>
    </>
  );
}
