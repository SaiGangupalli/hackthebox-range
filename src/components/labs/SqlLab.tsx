"use client";
import { useState } from "react";
import { Icon } from "../icons";
import { AutoTaskList } from "./AutoTaskList";
import { login, type LoginOutcome } from "@/lib/sim/sql";
import type { SqlLab as SqlLabData } from "@/data/labs/sqlLabs";

// A deliberately vulnerable login form next to its parameterized fix, so the
// difference is something you do, not just read. The SQL engine runs in the
// browser over a toy in-memory users table (src/lib/sim/sql.ts).
export function SqlLab({ lab }: { lab: SqlLabData }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [fixed, setFixed] = useState(false);
  const [res, setRes] = useState<LoginOutcome | null>(null);
  const [events, setEvents] = useState<Set<string>>(new Set());

  function submit() {
    const r = login(lab.users, user, pass, fixed);
    setRes(r);
    setEvents((prev) => {
      const next = new Set(prev);
      r.events.forEach((e) => next.add(e));
      // Mark a genuine (non-injection) successful login.
      if (r.user && !r.events.some((e) => e.startsWith("sqli:"))) next.add("login:legit");
      return next;
    });
  }

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="webmobile" /><b>{lab.title}</b></div>
        <span className="lab-sim">simulated · lab target</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>

      <div className="sqli">
        <div className="sqli-form">
          <label className={`sqli-toggle${fixed ? " on" : ""}`}>
            <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
            <span className="sqli-switch" aria-hidden="true" />
            <span>Parameterized query <b>(the fix)</b> — {fixed ? "ON" : "OFF"}</span>
          </label>
          <div className="field">
            <label htmlFor="sqlu">username</label>
            <input id="sqlu" type="text" value={user} onChange={(e) => setUser(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} spellCheck={false} autoCapitalize="off" placeholder="username" />
          </div>
          <div className="field">
            <label htmlFor="sqlp">password</label>
            <input id="sqlp" type="text" value={pass} onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} spellCheck={false} autoCapitalize="off" placeholder="password" />
          </div>
          <button className="btn primary sqli-go" onClick={submit}><Icon name="webmobile" />Log in</button>
          <div className="sqli-samples">
            <span>samples:</span>
            {lab.samples.map((s) => (
              <button key={s.label} className="chip cmd-chip" onClick={() => { setUser(s.user); setPass(s.pass); }}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="sqli-out">
          <div className="sqli-q-label">query sent to the database</div>
          <pre className="sqli-q">{res ? res.sql : "(submit the form to see the query)"}</pre>
          {res?.params && <div className="sqli-params">bound values: {res.params.map((p, i) => <code key={i}>{JSON.stringify(p)}</code>)}</div>}
          {res && <Result res={res} />}
        </div>
      </div>

      <AutoTaskList tasks={lab.tasks} events={events} />
    </div>
  );
}

function Result({ res }: { res: LoginOutcome }) {
  if (res.outcome.kind === "error") {
    return (
      <div className="sqli-result err">
        <Icon name="shield" />
        <div><b>Database error.</b> {res.outcome.message}<br /><span className="sqli-note">A raw DB error reaching the user is itself a leak — but notice the quote broke the query, which is the opening.</span></div>
      </div>
    );
  }
  const rows = res.outcome.rows;
  if (!rows.length) {
    return <div className="sqli-result no"><Icon name="circle" /> <div>No matching user — login refused.{res.events.includes("sqli:param-safe") && <><br /><span className="sqli-note">The injection was treated as a literal username, so it matched nobody. The fix held.</span></>}</div></div>;
  }
  const bypass = res.events.includes("sqli:bypass");
  const admin = res.user?.role === "admin";
  return (
    <div className={`sqli-result ${bypass ? "warn" : "ok"}`}>
      <Icon name={bypass ? "shield" : "check"} />
      <div>
        <b>Logged in as {String(res.user?.username)}</b> ({String(res.user?.role)}).
        {bypass && <><br /><span className="sqli-note">{admin ? "You became admin without the password" : "You logged in without valid credentials"} — the injected input changed the query. On a real app this is account takeover.</span></>}
        {res.events.includes("sqli:union") && <><br /><span className="sqli-note">A UNION pulled extra columns from the table into the result — data exfiltration via the login.</span></>}
        {rows.length > 1 && <div className="sqli-rows">{rows.length} rows returned.</div>}
      </div>
    </div>
  );
}
