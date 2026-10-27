"use client";
import { useState } from "react";
import { Icon } from "../icons";
import { TaskList } from "./TaskList";
import { ENCODERS, identifyHash } from "@/lib/cryptoTools";
import type { CryptoLab as CryptoLabData } from "@/data/labs/cryptoLabs";
import { LabHowTo } from "./LabHowTo";

// Operations offered by the chaining decoder, labelled for beginners.
const OPS: [string, string][] = [
  ["b64d", "Base64 → text"],
  ["b32d", "Base32 → text"],
  ["hexd", "Hex → text"],
  ["rot13", "ROT13"],
  ["atbash", "Atbash"],
  ["bind", "Binary → text"],
  ["urld", "URL-decode"],
  ["rev", "Reverse"],
  ["b64e", "text → Base64"],
  ["hexe", "text → Hex"],
];

type Step = { op: string; result: string };

// A CyberChef-lite decoder: apply one reversible operation at a time and chain
// them, watching the value change until a flag appears. Pure client-side.
export function CryptoLab({ lab }: { lab: CryptoLabData }) {
  const [value, setValue] = useState(lab.samples[0].value);
  const [op, setOp] = useState("b64d");
  const [steps, setSteps] = useState<Step[]>([]);
  const [err, setErr] = useState("");

  function apply() {
    try {
      const out = ENCODERS[op](value);
      setSteps((s) => [...s, { op, result: out }]);
      setValue(out);
      setErr("");
    } catch {
      setErr(`Couldn’t apply “${OPS.find(([k]) => k === op)?.[1] ?? op}” to this input — is it the right operation?`);
    }
  }
  function load(v: string) { setValue(v); setSteps([]); setErr(""); }

  const guesses = identifyHash(value);

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="crypto" /><b>{lab.title}</b></div>
        <span className="lab-sim">in-browser · no key needed</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>
      <LabHowTo tool="Load a sample, pick an operation and press Apply. If the result still looks scrambled, apply another." />

      <div className="cryp">
        <div className="cryp-samples">
          <span>load:</span>
          {lab.samples.map((s) => (
            <button key={s.label} className="chip cmd-chip" onClick={() => load(s.value)}>{s.label}</button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="crypIn">working value</label>
          <textarea id="crypIn" value={value} onChange={(e) => { setValue(e.target.value); setSteps([]); }} spellCheck={false} />
        </div>

        <div className="cryp-ctrl">
          <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="operation">
            {OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn primary" onClick={apply}><Icon name="zap" />Apply</button>
          {steps.length > 0 && <button className="btn" onClick={() => load(lab.samples[0].value)}>Reset</button>}
          {guesses.length > 0 && <span className="cryp-id">looks like: {guesses.join(" · ")}</span>}
        </div>

        {err && <div className="cryp-err"><Icon name="shield" /> {err}</div>}

        {steps.length > 0 && (
          <div className="cryp-steps">
            <div className="cryp-steps-h">pipeline</div>
            {steps.map((s, i) => (
              <div className="cryp-step" key={i}>
                <span className="cryp-op">{OPS.find(([k]) => k === s.op)?.[1] ?? s.op}</span>
                <span className="cryp-arrow">→</span>
                <span className="cryp-res">{s.result}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskList labId={lab.id} tasks={lab.tasks} />
    </div>
  );
}
