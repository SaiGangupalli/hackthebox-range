"use client";
import { useState } from "react";
import { Icon } from "../icons";
import { InlineCode } from "../InlineCode";
import type { AutoTask } from "@/data/labs/types";

// Objectives that complete by doing, not by typing. The parent lab passes the
// set of event tags it has seen; each objective lights up when its condition is
// met. Used by the compare-and-fix labs (SQL login, prompt injection).
export function AutoTaskList({ tasks, events }: { tasks: AutoTask[]; events: Set<string> }) {
  const [reveal, setReveal] = useState<boolean[]>(() => tasks.map(() => false));
  const done = tasks.map((t) => t.done(events));
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
              <button className="task-hintbtn" onClick={() => setReveal((r) => r.map((x, k) => (k === i ? !x : x)))}>
                {reveal[i] ? "Hide approach" : "Show approach"}
              </button>
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
