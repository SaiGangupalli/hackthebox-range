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
export function AutoTaskList({ labId, tasks, events }: { labId: string; tasks: AutoTask[]; events: Set<string> }) {
  const [reveal, setReveal] = useState<boolean[]>(() => tasks.map(() => false));
  const [saved, setSaved] = useState<boolean[]>(() => tasks.map(() => false));

  useEffect(() => {
    const load = () => setSaved(loadLab(labId, tasks.length));
    load();
    return onLabChange(labId, load);
  }, [labId, tasks.length]);

  const done = tasks.map((t, i) => saved[i] || t.done(events));
  const key = done.map(Number).join("");
  useEffect(() => {
    if (done.some((d, i) => d && !saved[i])) { setSaved(done); saveLab(labId, done); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const solved = done.filter(Boolean).length;

  return (
    <div className="tasks">
      <div className="tasks-head">
        <span><Icon name="flag" /> Objectives</span>
        <span className="tasks-count">{solved}/{tasks.length} done</span>
      </div>
      {tasks.map((t, i) => (
        <div className={`task${done[i] ? " done" : ""}`} key={i}>
          <div className="task-ask">
            <span className="task-mark">{done[i] ? <Icon name="check" /> : i + 1}</span>
            <span><InlineCode text={t.ask} /></span>
          </div>
          {done[i] ? (
            <div className="task-sol"><Icon name="check" /> <span><InlineCode text={t.solution} /></span></div>
          ) : (
            <>
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
