"use client";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { InlineCode } from "../InlineCode";
import type { AutoTask } from "@/data/labs/types";
import { loadLab, saveLab, onLabChange } from "@/lib/labProgress";
import { askTutor } from "@/lib/tutor";

// Objectives that complete by doing, not by typing. The parent lab passes the
// set of event tags it has seen; each objective lights up when its condition is
// met, and stays done across reloads. Used by the SQL-login and chatbot labs.
// "Practise again" re-opens an objective and asks the lab to forget what it has
// seen this visit (onReset), so it completes again only when you redo it.
export function AutoTaskList({ labId, tasks, events, onReset }: { labId: string; tasks: AutoTask[]; events: Set<string>; onReset?: () => void }) {
  const [reveal, setReveal] = useState<boolean[]>(() => tasks.map(() => false));
  const [saved, setSaved] = useState<boolean[]>(() => tasks.map(() => false));
  const [retry, setRetry] = useState<boolean[]>(() => tasks.map(() => false));

  useEffect(() => {
    const load = () => setSaved(loadLab(labId, tasks.length));
    load();
    return onLabChange(labId, load);
  }, [labId, tasks.length]);

  const done = tasks.map((t, i) => (retry[i] ? t.done(events) : saved[i] || t.done(events)));
  const key = done.map(Number).join("");
  useEffect(() => {
    if (done.some((d, i) => d && !saved[i])) { setSaved(done); saveLab(labId, done); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const solved = tasks.filter((t, i) => saved[i] || t.done(events)).length;

  function practise(which: number[]) {
    const set = new Set(which);
    setRetry((r) => r.map((x, k) => x || set.has(k)));
    setReveal((r) => r.map((x, k) => (set.has(k) ? false : x)));
    onReset?.();
  }

  return (
    <div className="tasks">
      <div className="tasks-head">
        <span><Icon name="flag" /> Objectives</span>
        <span className="tasks-count">
          {solved}/{tasks.length} done
          {onReset && saved.some(Boolean) && (
            <button className="task-hintbtn tasks-again" onClick={() => practise(tasks.map((_, k) => k))}>Practise all again</button>
          )}
        </span>
      </div>
      {tasks.map((t, i) => (
        <div className={`task${done[i] ? " done" : ""}`} key={i}>
          <div className="task-ask">
            <span className="task-mark">{done[i] ? <Icon name="check" /> : i + 1}</span>
            <span><InlineCode text={t.ask} /></span>
          </div>
          {done[i] ? (
            <>
              <div className="task-sol"><Icon name="check" /> <span><InlineCode text={t.solution} /></span></div>
              {onReset && (
                <span className="task-help">
                  {retry[i] && <span className="task-again-ok">Done again!</span>}
                  <button className="task-hintbtn" onClick={() => practise([i])}>Try again</button>
                </span>
              )}
            </>
          ) : (
            <>
              {retry[i] && <div className="task-msg retry">Practising again — your progress is kept. Do it once more in the lab above.</div>}
              <span className="task-help">
                <button className="task-hintbtn" onClick={() => setReveal((r) => r.map((x, k) => (k === i ? !x : x)))}>
                  {reveal[i] ? "Hide approach" : "Show approach"}
                </button>
                <button className="task-hintbtn tutor-link" onClick={() => askTutor({ kind: "nudge", labId, index: i }, `I'm stuck on objective ${i + 1} — can you give me a nudge?`)}>
                  <Icon name="llm" />Ask the tutor for a nudge
                </button>
              </span>
              {reveal[i] && (
                <div className="task-hint">
                  <p><b>Approach:</b> <InlineCode text={t.hint} /></p>
                  <details><summary>Explain the takeaway</summary><p><InlineCode text={t.solution} /></p></details>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
