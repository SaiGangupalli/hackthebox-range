"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import type { Announcement, AuditEntry } from "@/lib/settings";
import type { EventInfo } from "@/lib/event";

export type AdminData = {
  me: string;
  announcement: Announcement | null;
  challenges: { id: string; title: string; track: string; points: number; solves: number; hidden: boolean }[];
  players: { handle: string; joined: string; solved: number; points: number; team: string | null; banned: boolean; admin: boolean }[];
  suspicious: { a: string; b: string; count: number; sameTeam: boolean; challenges: string[] }[];
  audit: AuditEntry[];
  event: EventInfo;
  windowSeconds: number;
};

const when = (iso: string) => new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The organizer console's controls. Every action goes through /api/admin, which
// re-checks that you're an organizer; the page then refreshes from the server.
export function AdminPanel({ data }: { data: AdminData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [text, setText] = useState("");
  const [level, setLevel] = useState<"info" | "warn">("info");
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState<{ handle: string; password: string } | null>(null);

  async function act(body: Record<string, unknown>, done: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(JSON.stringify(body));
    setMsg(null);
    try {
      const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ kind: "err", text: out.error ?? "That didn't work." }); return; }
      if (out.password) setTemp({ handle: out.handle, password: out.password });
      setMsg({ kind: "ok", text: done });
      if (body.action === "announce") setText("");
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error — nothing was changed." });
    } finally {
      setBusy(null);
    }
  }

  const players = data.players.filter((p) => p.handle.includes(q.trim().toLowerCase()));
  const hiddenCount = data.challenges.filter((c) => c.hidden).length;
  const bannedCount = data.players.filter((p) => p.banned).length;

  return (
    <div className="admin">
      {msg && <div className={`admin-msg ${msg.kind}`} role="status"><Icon name={msg.kind === "ok" ? "check" : "flag"} />{msg.text}</div>}

      <div className="admin-stats">
        <div><b>{data.players.length}</b><span>players</span></div>
        <div><b>{data.challenges.reduce((s, c) => s + c.solves, 0)}</b><span>solves</span></div>
        <div><b>{hiddenCount}</b><span>hidden challenges</span></div>
        <div><b>{bannedCount}</b><span>banned</span></div>
        <div><b className="cap">{data.event.state}</b><span>event mode</span></div>
      </div>

      <section className="admin-card">
        <h2><Icon name="zap" />Announcement</h2>
        <p className="admin-help">Shown at the top of every page for everyone, within a minute. Use it for start times, hint drops or fixes.</p>
        {data.announcement ? (
          <div className={`announce-preview ${data.announcement.level}`}>
            <span>{data.announcement.text}</span>
            <small>posted by {data.announcement.by} · {when(data.announcement.at)}</small>
            <button className="btn" disabled={!!busy} onClick={() => act({ action: "clear-announcement" }, "Announcement cleared.")}>Clear</button>
          </div>
        ) : <p className="admin-empty">No announcement right now.</p>}
        <div className="admin-form">
          <textarea value={text} maxLength={280} rows={2} placeholder="e.g. Challenges open at 10:00 — good luck!" onChange={(e) => setText(e.target.value)} aria-label="Announcement text" />
          <div className="admin-row">
            <select value={level} onChange={(e) => setLevel(e.target.value as "info" | "warn")} aria-label="Announcement style">
              <option value="info">Info (blue)</option>
              <option value="warn">Important (amber)</option>
            </select>
            <span className="admin-count">{text.length}/280</span>
            <button className="btn primary" disabled={!!busy || !text.trim()} onClick={() => act({ action: "announce", text, level }, "Announcement published.")}>
              <Icon name="zap" />{data.announcement ? "Replace announcement" : "Publish"}
            </button>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <h2><Icon name="flag" />Challenges</h2>
        <p className="admin-help">Hide a challenge that&apos;s broken or leaked: players stop seeing it and can&apos;t submit. Points already scored are kept.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Challenge</th><th>Track</th><th>Points</th><th>Solves</th><th /></tr></thead>
            <tbody>
              {data.challenges.map((c) => (
                <tr key={c.id} className={c.hidden ? "muted" : ""}>
                  <td><b>{c.title}</b><small>{c.id}</small></td>
                  <td>{c.track}</td>
                  <td>{c.points}</td>
                  <td>{c.solves}</td>
                  <td className="admin-actions">
                    {c.hidden
                      ? <button className="btn" disabled={!!busy} onClick={() => act({ action: "show", challengeId: c.id }, `“${c.title}” is visible again.`)}>Show</button>
                      : <button className="btn" disabled={!!busy} onClick={() => act({ action: "hide", challengeId: c.id }, `“${c.title}” is hidden.`, `Hide “${c.title}” from players?`)}>Hide</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2><Icon name="network" />Players</h2>
        <p className="admin-help">Banning signs the player out everywhere, blocks sign-in and removes them from the scoreboard and feed. A password reset gives you a temporary password to hand over — they can change it on their account page.</p>
        {temp && (
          <div className="admin-temp">
            <div>Temporary password for <b>{temp.handle}</b> (shown once — give it to them in person):</div>
            <code>{temp.password}</code>
            <button className="task-hintbtn" onClick={() => { navigator.clipboard?.writeText(temp.password).catch(() => {}); }}>copy</button>
            <button className="task-hintbtn" onClick={() => setTemp(null)}>done</button>
          </div>
        )}
        <input className="admin-search" type="text" placeholder="filter by handle…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter players" />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Player</th><th>Team</th><th>Solved</th><th>Points</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {players.slice(0, 200).map((p) => (
                <tr key={p.handle} className={p.banned ? "muted" : ""}>
                  <td><Link href={`/u/${p.handle}`}><b>{p.handle}</b></Link>{p.admin && <span className="admin-tag">organizer</span>}{p.banned && <span className="admin-tag bad">banned</span>}</td>
                  <td>{p.team ?? "—"}</td>
                  <td>{p.solved}</td>
                  <td>{p.points}</td>
                  <td>{when(p.joined)}</td>
                  <td className="admin-actions">
                    {!p.admin && (p.banned
                      ? <button className="btn" disabled={!!busy} onClick={() => act({ action: "unban", handle: p.handle }, `${p.handle} is unbanned.`)}>Unban</button>
                      : <button className="btn" disabled={!!busy} onClick={() => act({ action: "ban", handle: p.handle }, `${p.handle} is banned.`, `Ban ${p.handle}? They'll be signed out and removed from the scoreboard.`)}>Ban</button>)}
                    <button className="btn" disabled={!!busy} onClick={() => act({ action: "reset-password", handle: p.handle }, `Password reset for ${p.handle}.`, `Reset ${p.handle}'s password? Their old password stops working.`)}>Reset password</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {players.length > 200 && <p className="admin-empty">Showing 200 of {players.length} — filter to narrow it down.</p>}
        </div>
      </section>

      <section className="admin-card">
        <h2><Icon name="shield" />Possible flag sharing</h2>
        <p className="admin-help">Pairs of players who solved two or more of the same challenges within {data.windowSeconds} seconds of each other. It&apos;s a lead, not proof — teammates and friends working side by side show up too.</p>
        {data.suspicious.length ? (
          <ul className="admin-list">
            {data.suspicious.map((s) => (
              <li key={`${s.a}|${s.b}`}>
                <b><Link href={`/u/${s.a}`}>{s.a}</Link></b> &amp; <b><Link href={`/u/${s.b}`}>{s.b}</Link></b>
                <span>{s.count} near-simultaneous solves{s.sameTeam ? " · same team (expected)" : ""}</span>
                <small>{s.challenges.join(", ")}</small>
              </li>
            ))}
          </ul>
        ) : <p className="admin-empty">Nothing suspicious so far.</p>}
      </section>

      <section className="admin-card">
        <h2><Icon name="book" />Audit log</h2>
        {data.audit.length ? (
          <ul className="admin-list audit">
            {data.audit.map((a, i) => (
              <li key={i}><small>{when(a.at)}</small><b>{a.by}</b><span>{a.action}{a.target ? <> · <code>{a.target}</code></> : null}</span></li>
            ))}
          </ul>
        ) : <p className="admin-empty">No organizer actions yet.</p>}
      </section>
    </div>
  );
}
