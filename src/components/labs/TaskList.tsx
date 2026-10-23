"use client";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { InlineCode } from "../InlineCode";
import type { Task } from "@/data/labs/types";

// Objectives panel shared by every practice lab. You answer each question using
// the live tool above it; completion persists per-lab in localStorage so your
// progress survives a reload. "Show approach" reveals the method, not the answer.
export function TaskList({ labId, tasks }: { labId: string; tasks: Task[] }) {
  const key = `hhb_lab_${labId}`;
  const [done, setDone] = useState<boolean[]>(() => tasks.map(() => false));
  const [answers, setAnswers] = useState<string[]>(() => tasks.map(() => ""));
  const [reveal, setReveal] = useState<boolean[]>(() => tasks.map(() => false));
  const [status, setStatus] = useState<(null | "wrong")[]>(() => tasks.map(() => null));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { const saved = JSON.parse(raw) as boolean[]; if (Array.isArray(saved) && saved.length === tasks.length) setDone(saved); }
    } catch { /* storage blocked */ }
  }, [key, tasks.length]);

  function persist(next: boolean[]) {
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function submit(i: number) {
    if (!answers[i].trim()) return;
    if (tasks[i].check(answers[i])) {
      const next = [...done]; next[i] = true; persist(next);
      setStatus((s) => s.map((x, k) => (k === i ? null : x)));
    } else {
      setStatus((s) => s.map((x, k) => (k === i ? "wrong" : x)));
    }
  }

  const solved = done.filter(Boolean).length;

  return (
    <div className="tasks">
      <div className="tasks-head">
        <span><Icon name="flag" /> Objectives</span>
        <span className="tasks-count">{solved}/{tasks.length} solved</span>
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
              <div className="task-input">
                <input
                  type="text"
                  value={answers[i]}
                  placeholder={t.placeholder ?? "your answer"}
                  aria-label={`answer to objective ${i + 1}`}
                  spellCheck={false}
                  autoCapitalize="off"
                  onChange={(e) => { setAnswers((a) => a.map((x, k) => (k === i ? e.target.value : x))); setStatus((s) => s.map((x, k) => (k === i ? null : x))); }}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(i); }}
                />
                <button className="btn primary" onClick={() => submit(i)}>Check</button>
              </div>
              {status[i] === "wrong" && <div className="task-msg wrong">Not quite — explore a bit more, or show the approach.</div>}
              <button className="task-hintbtn" onClick={() => setReveal((r) => r.map((x, k) => (k === i ? !x : x)))}>
                {reveal[i] ? "Hide approach" : "Show approach"}
              </button>
              {reveal[i] && (
                <div className="task-hint">
                  <p><b>Approach:</b> <InlineCode text={t.hint} /></p>
                  <details><summary>Reveal the answer</summary><p><InlineCode text={t.solution} /></p></details>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
