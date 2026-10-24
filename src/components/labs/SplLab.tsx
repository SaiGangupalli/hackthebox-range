"use client";
import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { TaskList } from "./TaskList";
import { extractEvents, runSpl, fieldSummary, type SplResult } from "@/lib/sim/spl";
import type { SplLab as SplLabData } from "@/data/labs/splLabs";
import { LabHowTo } from "./LabHowTo";

// A miniature Splunk search over in-memory events. Everything runs in the
// browser; the SPL subset is documented in src/lib/sim/spl.ts.
export function SplLab({ lab }: { lab: SplLabData }) {
  const events = useMemo(() => extractEvents(lab.sources), [lab]);
  const fields = useMemo(() => fieldSummary(events), [events]);
  const [query, setQuery] = useState(lab.starters[0]);
  const [ran, setRan] = useState<{ result?: SplResult; error?: string; q: string } | null>(null);

  function run(q = query) {
    const r = runSpl(events, q);
    setRan(r.ok ? { result: r.result, q } : { error: r.error, q });
  }

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="splunk" /><b>{lab.title}</b></div>
        <span className="lab-sim">simulated · {events.length} events</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>
      <LabHowTo tool="Type a search in the bar and press Enter — or click a starter search. Click a field name to add it." />

      <div className="spl">
        <div className="spl-bar">
          <span className="spl-gt">&gt;</span>
          <input
            className="spl-in"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            spellCheck={false}
            autoCapitalize="off"
            aria-label="SPL search"
            placeholder="index=auth action=Failed | stats count by user | sort -count"
          />
          <button className="btn primary" onClick={() => run()}><Icon name="splunk" />Search</button>
        </div>

        <div className="spl-tips">
          <span>starters:</span>
          {lab.starters.map((s) => (
            <button key={s} className="chip cmd-chip" onClick={() => { setQuery(s); run(s); }}>{s}</button>
          ))}
        </div>

        <div className="spl-main">
          <aside className="spl-fields">
            <div className="spl-fields-h">fields</div>
            {fields.map((f) => (
              <button key={f} className="spl-field" onClick={() => setQuery((q) => `${q} ${f}=`)}>{f}</button>
            ))}
          </aside>
          <div className="spl-out">
            {!ran ? (
              <div className="spl-empty">Run a search to see results.</div>
            ) : ran.error ? (
              <div className="spl-err"><Icon name="shield" /> {ran.error}</div>
            ) : (
              <Results result={ran.result!} />
            )}
          </div>
        </div>
      </div>

      <TaskList labId={lab.id} tasks={lab.tasks} />
    </div>
  );
}

function Results({ result }: { result: SplResult }) {
  if (result.kind === "table") {
    if (!result.rows.length) return <div className="spl-empty">No results.</div>;
    return (
      <div className="spl-table-wrap">
        <table className="spl-table">
          <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i}>{result.columns.map((c) => <td key={c}>{String(r[c] ?? "")}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (!result.events.length) return <div className="spl-empty">No matching events.</div>;
  return (
    <div className="spl-events">
      <div className="spl-events-n">{result.events.length} event{result.events.length === 1 ? "" : "s"}</div>
      {result.events.slice(0, 50).map((e, i) => (
        <div className="spl-event" key={i}>
          <span className="spl-time">{e._time}</span>
          <span className="spl-raw">{e._raw}</span>
        </div>
      ))}
      {result.events.length > 50 && <div className="spl-more">…{result.events.length - 50} more</div>}
    </div>
  );
}
