"use client";
import { useEffect, useRef, useState } from "react";
import type { Shell } from "@/lib/sim/shell";

type Line = { kind: "in" | "out"; text: string };

// An interactive simulated terminal over a Shell engine (in-memory filesystem —
// no real machine is touched). ↑/↓ recall history, Tab completes, suggestion
// chips fill the prompt. `onRun` reports each command and its output (used by
// the command dojo to check drills); `prefill` puts text at the prompt when its
// `n` changes.
export function Terminal({ shell, motd, suggest = [], onRun, prefill }: {
  shell: Shell;
  motd?: string;
  suggest?: string[];
  onRun?: (cmd: string, out: string) => void;
  prefill?: { text: string; n: number };
}) {
  const [lines, setLines] = useState<Line[]>(() => (motd ? [{ kind: "out", text: motd }] : []));
  const [input, setInput] = useState("");
  const [hist, setHist] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefill?.n) { setInput(prefill.text); inputRef.current?.focus(); }
  }, [prefill?.n, prefill?.text]);

  function scroll() { requestAnimationFrame(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; }); }

  function runLine(cmd: string) {
    const prompt = shell.prompt();
    const res = shell.run(cmd);
    if (res.clear) { setLines([]); setInput(""); setHist(-1); scroll(); return; }
    setLines((ls) => [...ls, { kind: "in", text: `${prompt} ${cmd}` }, ...(res.out ? [{ kind: "out" as const, text: res.out.replace(/\n$/, "") }] : [])]);
    setInput("");
    setHist(-1);
    scroll();
    if (cmd.trim()) onRun?.(cmd.trim(), res.out);
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
    <>
      <div className="term" onClick={() => inputRef.current?.focus()}>
        <div className="term-bar"><span className="dot r" /><span className="dot y" /><span className="dot g" /><span className="term-title">{shell.spec.user}@{shell.spec.host}</span></div>
        <div className="term-body" ref={bodyRef}>
          {lines.map((l, i) => (
            <div key={i} className={`term-line is-${l.kind}`}>{l.text}</div>
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
        {suggest.length > 0 && <span>try:</span>}
        {suggest.map((c) => (
          <button key={c} className="chip cmd-chip" onClick={() => { setInput(c); inputRef.current?.focus(); }}>{c}</button>
        ))}
        <span className="term-help">· type <code>help</code> for commands · ↑/↓ history · Tab completes</span>
      </div>
    </>
  );
}
