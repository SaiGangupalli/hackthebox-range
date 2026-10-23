"use client";
import { useRef, useState } from "react";
import { Icon } from "../icons";
import { AutoTaskList } from "./AutoTaskList";
import { reply, assemble, type Defenses } from "@/lib/sim/llm";
import type { PromptLab as PromptLabData } from "@/data/labs/promptLabs";

type Turn = { from: "you" | "bot"; text: string; notes?: string[] };

const DEFS: { key: keyof Defenses; label: string; blurb: string }[] = [
  { key: "inputFilter", label: "Input filter", blurb: "blocks known attack phrases in your message" },
  { key: "outputFilter", label: "Output filter", blurb: "redacts the secret from replies (exact matches only)" },
  { key: "spotlight", label: "Spotlighting", blurb: "marks retrieved reviews as data, not instructions" },
];

// A simulated support bot (rule-based — no real model) for learning prompt
// injection and its defenses. Rules + events: src/lib/sim/llm.ts.
export function PromptLab({ lab }: { lab: PromptLabData }) {
  const [def, setDef] = useState<Defenses>({ inputFilter: false, outputFilter: false, spotlight: false });
  const [turns, setTurns] = useState<Turn[]>([{ from: "bot", text: lab.spec.greeting }]);
  const [msg, setMsg] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set());
  const [showAssembled, setShowAssembled] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  function send(text = msg) {
    if (!text.trim()) return;
    const withDocs = /review|summar|feedback|rating|opinion/i.test(text);
    const r = reply(lab.spec, text, def);
    setTurns((t) => [...t, { from: "you", text }, { from: "bot", text: r.text, notes: r.notes }]);
    setEvents((prev) => { const n = new Set(prev); r.events.forEach((e) => n.add(e)); return n; });
    setMsg("");
    void withDocs;
    requestAnimationFrame(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; });
  }

  const lastUser = [...turns].reverse().find((t) => t.from === "you")?.text ?? "(your message)";

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="genai" /><b>{lab.title}</b></div>
        <span className="lab-sim">simulated bot · no real model</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>

      <div className="llm-defs">
        {DEFS.map((d) => (
          <label key={d.key} className={`llm-def${def[d.key] ? " on" : ""}`} title={d.blurb}>
            <input type="checkbox" checked={def[d.key]} onChange={(e) => setDef((v) => ({ ...v, [d.key]: e.target.checked }))} />
            <span className="sqli-switch" aria-hidden="true" />
            <span className="llm-def-txt"><b>{d.label}</b><small>{d.blurb}</small></span>
          </label>
        ))}
      </div>

      <div className="llm-chat">
        <div className="llm-body" ref={bodyRef}>
          {turns.map((t, i) => (
            <div key={i} className={`llm-turn ${t.from}`}>
              <div className="llm-who">{t.from === "you" ? "you" : "ShopBot"}</div>
              <div className="llm-bubble">{t.text}</div>
              {t.notes?.map((n, k) => <div className="llm-note" key={k}><Icon name="shield" />{n}</div>)}
            </div>
          ))}
        </div>
        <div className="llm-input">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="message ShopBot…"
            aria-label="message"
            spellCheck={false}
          />
          <button className="btn primary" onClick={() => send()}><Icon name="genai" />Send</button>
        </div>
      </div>

      <div className="llm-tips">
        <span>try:</span>
        {lab.starters.map((s) => (
          <button key={s} className="chip cmd-chip" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <button className="task-hintbtn llm-peek" onClick={() => setShowAssembled((v) => !v)}>
        {showAssembled ? "Hide what the model receives" : "Show what the model actually receives"}
      </button>
      {showAssembled && (
        <pre className="llm-assembled">{assemble(lab.spec, lastUser, def, true)}</pre>
      )}

      <AutoTaskList tasks={lab.tasks} events={events} />
    </div>
  );
}
