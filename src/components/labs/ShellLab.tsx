"use client";
import { useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { TaskList } from "./TaskList";
import { Shell } from "@/lib/sim/shell";
import type { ShellLab as ShellLabData } from "@/data/labs/shellLabs";

type Line = { kind: "in" | "out"; text: string };

// An interactive simulated terminal. The Shell engine runs entirely in the
// browser over an in-memory filesystem — no real machine is touched. ↑/↓ recall
// history, Tab completes, and the suggested chips seed useful first commands.
export function ShellLab({ lab }: { lab: ShellLabData }) {
  const shell = useMemo(() => new Shell(lab.spec), [lab]);
  const [lines, setLines] = useState<Line[]>(() => (lab.spec.motd ? [{ kind: "out", text: lab.spec.motd }] : []));
  const [input, setInput] = useState("");
  const [hist, setHist] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scroll() { requestAnimationFrame(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; }); }

  function runLine(cmd: string) {
    const prompt = shell.prompt();
    const res = shell.run(cmd);
    if (res.clear) { setLines([]); setInput(""); setHist(-1); scroll(); return; }
    setLines((ls) => [...ls, { kind: "in", text: `${prompt} ${cmd}` }, ...(res.out ? [{ kind: "out" as const, text: res.out.replace(/\n$/, "") }] : [])]);
    setInput("");
    setHist(-1);
    scroll();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { runLine(input); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = shell.history;
      if (!h.length) return;
      const next = hist < 0 ? h.length - 1 : Math.max(0, hist - 1);
      setHist(next); setInput(h[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = shell.history;
      if (hist < 0) return;
      const next = hist + 1;
      if (next >= h.length) { setHist(-1); setInput(""); } else { setHist(next); setInput(h[next]); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const matches = shell.complete(input);
      if (matches.length === 1) {
        const words = input.split(/(\s+)/);
        words[words.length - 1] = matches[0];
        setInput(words.join(""));
      } else if (matches.length > 1) {
        setLines((ls) => [...ls, { kind: "in", text: `${shell.prompt()} ${input}` }, { kind: "out", text: matches.join("  ") }]);
        scroll();
      }
    }
  }

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="os" /><b>{lab.title}</b></div>
        <span className="lab-sim">simulated · in-browser</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>

      <div className="term" onClick={() => inputRef.current?.focus()}>
        <div className="term-bar"><span className="dot r" /><span className="dot y" /><span className="dot g" /><span className="term-title">{lab.spec.user}@{lab.spec.host}</span></div>
        <div className="term-body" ref={bodyRef}>
          {lines.map((l, i) => (
            <div key={i} className={`term-line ${l.kind}`}>{l.text}</div>
          ))}
          <div className="term-prompt">
            <span className="ps1">{shell.prompt()}</span>
            <input
              ref={inputRef}
              className="term-in"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="terminal input"
            />
          </div>
        </div>
      </div>

      <div className="term-tips">
        <span>try:</span>
        {(lab.spec.suggest ?? []).map((c) => (
          <button key={c} className="chip cmd-chip" onClick={() => { setInput(c); inputRef.current?.focus(); }}>{c}</button>
        ))}
        <span className="term-help">· type <code>help</code> for commands · ↑/↓ history · Tab completes</span>
      </div>

      <TaskList labId={lab.id} tasks={lab.tasks} />
    </div>
  );
}
