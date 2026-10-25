"use client";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { InlineCode } from "../InlineCode";
import type { Task } from "@/data/labs/types";
import { loadLab, saveLab, onLabChange } from "@/lib/labProgress";
import { askTutor } from "@/lib/tutor";

// Objectives panel shared by every practice lab. You answer each question using
// the live tool above it; completion persists per-lab (src/lib/labProgress) so
// your progress survives a reload and shows on the home page. After two wrong
// tries the approach opens on its own, so nobody stays stuck.
export function TaskList({ labId, tasks }: { labId: string; tasks: Task[] }) {
  const [done, setDone] = useState<boolean[]>(() => tasks.map(() => false));
  const [answers, setAnswers] = useState<string[]>(() => tasks.map(() => ""));
  const [reveal, setReveal] = useState<boolean[]>(() => tasks.map(() => false));
  const [misses, setMisses] = useState<number[]>(() => tasks.map(() => 0));
  const [status, setStatus] = useState<(null | "wrong" | "again")[]>(() => tasks.map(() => null));
  const [retry, setRetry] = useState<boolean[]>(() => tasks.map(() => false)); // re-practising a solved objective

  useEffect(() => {
    const load = () => setDone(loadLab(labId, tasks.length));
    load();
    return onLabChange(labId, load);
  }, [labId, tasks.length]);

  function persist(next: boolean[]) {
    setDone(next);
    saveLab(labId, next);
  }

  function submit(i: number) {
    if (!answers[i].trim()) return;
    if (tasks[i].check(answers[i])) {
      if (!done[i]) { const next = [...done]; next[i] = true; persist(next); }
      setStatus((s) => s.map((x, k) => (k === i ? (retry[i] ? "again" : null) : x)));
      setRetry((r) => r.map((x, k) => (k === i ? false : x)));
    } else {
      setStatus((s) => s.map((x, k) => (k === i ? "wrong" : x)));
      const n = misses[i] + 1;
      setMisses((m) => m.map((x, k) => (k === i ? n : x)));
      if (n >= 2) setReveal((r) => r.map((x, k) => (k === i ? true : x)));
    }
  }

  // Practise solved objectives again: progress is kept, the answer box re-opens.
  function practise(which: number[]) {
    const set = new Set(which);
    setRetry((r) => r.map((x, k) => x || set.has(k)));
    setAnswers((a) => a.map((x, k) => (set.has(k) ? "" : x)));
    setStatus((s) => s.map((x, k) => (set.has(k) ? null : x)));
    setReveal((r) => r.map((x, k) => (set.has(k) ? false : x)));
    setMisses((m) => m.map((x, k) => (set.has(k) ? 0 : x)));
  }

  const solved = done.filter(Boolean).length;

  return (
    <div className="tasks">
      <div className="tasks-head">
        <span><Icon name="flag" /> Objectives</span>
        <span className="tasks-count">
          {solved}/{tasks.length} solved
          {solved > 0 && (
            <button className="task-hintbtn tasks-again" onClick={() => practise(done.flatMap((d, k) => (d ? [k] : [])))}>Practise all again</button>
          )}
        </span>
      </div>
      {tasks.map((t, i) => (
        <div className={`task${done[i] ? " done" : ""}`} key={i}>
          <div className="task-ask">
            <span className="task-mark">{done[i] ? <Icon name="check" /> : i + 1}</span>
            <span><InlineCode text={t.ask} /></span>
          </div>
          {done[i] && !retry[i] ? (
            <>
              <div className="task-sol"><Icon name="check" /> <span><InlineCode text={t.solution} /></span></div>
              <span className="task-help">
                {status[i] === "again" && <span className="task-again-ok">Correct again!</span>}
                <button className="task-hintbtn" onClick={() => practise([i])}>Try again</button>
              </span>
            </>
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
              {status[i] === "wrong" && (
                <div className="task-msg wrong">
                  {misses[i] >= 2 ? "Not yet — the approach is open below to guide you." : "Not quite. Check spelling, then look again in the tool above."}
                </div>
              )}
              {retry[i] && <div className="task-msg retry">Practising again — your progress is kept.</div>}
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
