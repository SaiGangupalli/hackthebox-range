"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { Terminal } from "./labs/Terminal";
import { Shell } from "@/lib/sim/shell";
import { drills, drillOrder, dojoSpec, LEVELS, DOJO_ID, levelTier } from "@/data/drills";
import { passesDrill } from "@/lib/drillCheck";
import { loadLab, saveLab, onLabChange } from "@/lib/labProgress";
import { askTutor } from "@/lib/tutor";

// The command dojo: pick a drill, type commands in the terminal, and the drill
// completes when your command does what it asks (checked from what you ran,
// its output, where you ended up, or the file you made).
export function CommandDojo() {
  const [shellKey, setShellKey] = useState(0);
  const shell = useMemo(() => new Shell(dojoSpec), [shellKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [done, setDone] = useState<boolean[]>(() => drills.map(() => false));
  const [cur, setCur] = useState(0);
  const [hint, setHint] = useState(0); // 0 none · 1 hint · 2 example
  const [last, setLast] = useState<{ cmd: string; out: string; ok: boolean } | null>(null);
  const [justSolved, setJustSolved] = useState(false);
  const [again, setAgain] = useState(false); // re-practising a drill that's already done
  const [resetNote, setResetNote] = useState(false);
  const [prefill, setPrefill] = useState({ text: "", n: 0 });

  // Load saved progress (and react to account sync); start at the first unsolved drill.
  useEffect(() => {
    const load = () => setDone(loadLab(DOJO_ID, drills.length));
    const first = loadLab(DOJO_ID, drills.length);
    setDone(first);
    setCur(drillOrder.find((k) => !first[k]) ?? drillOrder[0]);
    return onLabChange(DOJO_ID, load);
  }, []);

  const d = drills[cur];
  const pos = drillOrder.indexOf(cur); // where this drill sits in the level-by-level order
  const solvedCount = done.filter(Boolean).length;

  function select(i: number) {
    setCur(i);
    setHint(0);
    setLast(null);
    setJustSolved(false);
    setAgain(false);
    setResetNote(false);
  }

  function onRun(cmd: string, out: string) {
    if (done[cur] && !again && !justSolved) { setLast(null); return; }
    if (justSolved) return;
    const ok = passesDrill(d.check, cmd, out, shell);
    setLast({ cmd, out, ok });
    if (!ok) return;
    if (!done[cur]) {
      const next = [...done];
      next[cur] = true;
      setDone(next);
      saveLab(DOJO_ID, next);
    }
    setAgain(false);
    setJustSolved(true);
  }

  // Re-open a finished drill. Drills checked by the files you change (or the
  // folder you're in) start from a fresh machine, so the old result can't count.
  function practiseAgain() {
    const c = d.check;
    const stateful = !!(c.file || c.dir || c.missing || c.mode || c.cwd);
    if (stateful) setShellKey((k) => k + 1);
    setResetNote(stateful);
    setAgain(true);
    setJustSolved(false);
    setHint(0);
    setLast(null);
  }

  function goNext() {
    const after = drillOrder.slice(pos + 1).find((k) => !done[k]);
    const any = drillOrder.find((k) => !done[k]);
    select(after ?? any ?? drillOrder[Math.min(pos + 1, drillOrder.length - 1)]);
  }

  const levelStats = LEVELS.map((name, i) => {
    const ids = drillOrder.filter((k) => drills[k].level === i + 1);
    return { name, n: i + 1, total: ids.length, solved: ids.filter((k) => done[k]).length, first: ids[0] };
  });
  const allDone = solvedCount === drills.length;

  return (
    <>
      <div className="dojo-progress">
        <div className="dojo-count"><b>{solvedCount}<i>/{drills.length}</i></b><span>drills complete · {solvedCount * 10} XP</span></div>
        <div className="bar"><i style={{ width: `${(solvedCount / drills.length) * 100}%` }} /></div>
      </div>

      <div className="dojo-levels" role="tablist" aria-label="Levels">
        {levelStats.map((l) => [
          (l.n === 1 || levelTier(l.n) !== levelTier(l.n - 1)) && <span key={`t${l.n}`} className={`dojo-tier lvl ${levelTier(l.n).toLowerCase()}`}>{levelTier(l.n)}</span>,
          <button key={l.n} role="tab" aria-selected={d.level === l.n} className={`dojo-level${d.level === l.n ? " on" : ""}${l.solved === l.total ? " done" : ""}`} onClick={() => select(l.first)}>
            <span className="dl-n">{l.solved === l.total ? <Icon name="check" /> : l.n}</span>
            <span className="dl-name">{l.name}</span>
            <span className="dl-c">{l.solved}/{l.total}</span>
          </button>,
        ])}
      </div>

      <div className={`drill${done[cur] ? " solved" : ""}`}>
        <div className="drill-top">
          <span className="drill-lv">Level {d.level} · {LEVELS[d.level - 1]} · {levelTier(d.level)} · drill {pos + 1} of {drills.length}</span>
          {done[cur] && <span className="ok-tag"><Icon name="check" />done</span>}
        </div>
        <h2>{d.title}</h2>
        <p className="drill-task">{d.task}</p>

        {justSolved || (done[cur] && !again) ? (
          <div className="drill-win">
            <b>{justSolved ? "Nice — that's it!" : "You've already completed this drill."}</b>
            <p><InlineCode text={d.explain} /></p>
            <div className="drill-actions">
              <button className="btn primary" onClick={goNext}>{allDone ? "Review another drill" : "Next drill →"}</button>
              <button className="btn" onClick={practiseAgain}><Icon name="zap" />Practise again</button>
            </div>
          </div>
        ) : (
          <>
            {again && (
              <p className="drill-again">
                <Icon name="zap" /> Practising again — your progress is kept.
                {resetNote && " The practice machine was reset so you can do it from scratch."}
              </p>
            )}
            <div className="drill-actions">
              <button className="btn" onClick={() => setHint((h) => Math.max(h, 1))}><Icon name="book" />Hint</button>
              {hint >= 1 && <button className="btn" onClick={() => setHint(2)}><Icon name="zap" />Show an example</button>}
              <button className="btn" onClick={() => askTutor({ kind: "drill-help", drillId: d.id, command: last?.cmd, output: last?.out }, last ? `Help with "${d.title}" — I ran: ${last.cmd}` : `How do I start "${d.title}"?`)}>
                <Icon name="llm" />{last ? "Ask the tutor about my last command" : "Ask the tutor"}
              </button>
              <button className="task-hintbtn" onClick={goNext}>Skip</button>
            </div>
            {hint >= 1 && <p className="drill-hint"><b>Hint</b> <InlineCode text={d.hint} /></p>}
            {hint >= 2 && (
              <div className="drill-example">
                <code>{d.example}</code>
                <button className="task-hintbtn" onClick={() => setPrefill((p) => ({ text: d.example, n: p.n + 1 }))}>Put it in the terminal</button>
                <small>Try to understand each part before you press Enter.</small>
              </div>
            )}
            {last && !last.ok && <p className="drill-miss">Your last command (<code>{last.cmd}</code>) didn&apos;t complete the drill yet — keep going, or use a hint.</p>}
          </>
        )}
      </div>

      <Terminal key={shellKey} shell={shell} motd={dojoSpec.motd} onRun={onRun} prefill={prefill} />
      <div className="dojo-reset"><button className="task-hintbtn" onClick={() => { setShellKey((k) => k + 1); setLast(null); }}>Reset the practice machine</button> <span>(puts every file back the way it started; your progress is kept)</span></div>

      <div className="sec-h"><Icon name="flag" />All drills</div>
      <div className="drill-list">
        {levelStats.map((l) => (
          <div key={l.n} className="dlist-level">
            <div className="dlist-h">Level {l.n} · {l.name}</div>
            {drillOrder.map((k, n) => drills[k].level === l.n && (
              <button key={drills[k].id} className={`dlist-item${k === cur ? " on" : ""}${done[k] ? " done" : ""}`} onClick={() => select(k)}>
                <span className="dli-mark">{done[k] ? <Icon name="check" /> : n + 1}</span>
                <span>{drills[k].title}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
