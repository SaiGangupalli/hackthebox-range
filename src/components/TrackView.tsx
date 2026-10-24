"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { tracks } from "@/data/tracks";
import { pathIndex, pathOrder } from "@/data/path";
import { Icon } from "./icons";
import { Copyable } from "./Copyable";
import { Learn } from "./Learn";
import { PracticeLab } from "./labs/PracticeLab";
import { Quiz } from "./Quiz";
import { useProgress, toggleDone } from "@/lib/progress";
import { useLabProgress } from "@/lib/labProgress";
import { useQuizProgress } from "@/lib/quizProgress";
import { askTutor } from "@/lib/tutor";

// A track is laid out as a five-step lesson — understand, practise, check,
// reference, defend — with a header that says where it sits in the learning path and a
// footer that sends you on to the next track.
const STEPS: [string, string][] = [
  ["learn", "Understand"],
  ["practice", "Practise"],
  ["check", "Check"],
  ["reference", "Reference"],
  ["defend", "Defend"],
];

function StepHead({ n, id, title, sub }: { n: number; id: string; title: string; sub: React.ReactNode }) {
  return (
    <div className="step-h" id={id}>
      <span className="step-n">{n}</span>
      <div><h2>{title}</h2><p>{sub}</p></div>
    </div>
  );
}

export function TrackView({ slug }: { slug: string }) {
  const track = tracks[slug];
  const step = pathIndex[slug];
  const { map } = useProgress();
  const lab = useLabProgress(step ? [step.labId] : []);
  const qz = useQuizProgress([slug])[slug];
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!track) return <p>Unknown track.</p>;
  const done = mounted && !!map[slug];
  const pos = pathOrder.indexOf(slug);
  const prev = pos > 0 ? tracks[pathOrder[pos - 1]] : null;
  const next = pos >= 0 && pos < pathOrder.length - 1 ? tracks[pathOrder[pos + 1]] : null;
  const lp = step ? lab[step.labId] : undefined;

  return (
    <>
      <div className="eyebrow">Learning path · step {pos + 1} of {pathOrder.length}</div>
      <h1 className="view-title">{track.title}</h1>
      <p className="lede">{track.blurb}</p>

      {step && (
        <div className="track-meta">
          <span className={`lvl ${step.level.toLowerCase()}`}>{step.level}</span>
          <span><Icon name="circle" />about {step.minutes} min</span>
          {lp && lp.total > 0 && <span className={lp.done === lp.total ? "ok" : ""}><Icon name="flag" />lab {lp.done}/{lp.total}</span>}
          {qz && <span className={qz.best === qz.total ? "ok" : ""}><Icon name="trophy" />quiz {qz.best}/{qz.total}</span>}
          {done && <span className="ok"><Icon name="check" />completed</span>}
          {step.prereq.length > 0 && (
            <span className="track-pre">
              helps to do first:{" "}
              {step.prereq.map((p, i) => (
                <span key={p}>{i > 0 && ", "}<Link href={`/tracks/${p}`}>{tracks[p].title}</Link></span>
              ))}
            </span>
          )}
        </div>
      )}

      {step && (
        <div className="outcomes">
          <div className="outcomes-h"><Icon name="trophy" />By the end of this track you can</div>
          <ul>{step.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
          <div className="outcomes-skills">{track.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
        </div>
      )}

      <nav className="stepbar" aria-label="Lesson steps">
        {STEPS.map(([id, label], i) => (
          <a key={id} href={`#${id}`} className="stepbar-item"><span>{i + 1}</span>{label}</a>
        ))}
      </nav>

      <Learn
        slug={slug}
        heading={<StepHead n={1} id="learn" title="Understand the basics" sub={<>Plain-English explanations, each with a worked example. Read these first. Stuck on a word? Check the <Link href="/glossary">glossary</Link>.</>} />}
      />

      <PracticeLab
        slug={slug}
        heading={<StepHead n={2} id="practice" title="Practise in the lab" sub="Try it yourself in a safe simulator. Answer the objectives as you go — use “Show approach” if you get stuck." />}
      />

      <Quiz
        slug={slug}
        heading={<StepHead n={3} id="check" title="Check your understanding" sub="Four quick questions. Pick an answer to see straight away whether it's right — and why." />}
      />

      <StepHead n={4} id="reference" title="Quick reference" sub="The commands and tools from this track, for when you need them again. Click a command to copy it, or Explain to have the AI tutor break it down." />
      <div className="card">
        {track.sheets.map((sh) => (
          <div className="sheet" key={sh.title}>
            <div className="sheet-t">{sh.title}</div>
            <div className="rows">
              {sh.rows.map((r, i) => (
                <div className="row" key={i}>
                  <Copyable text={r.code} />
                  <span className="note">
                    {r.note}
                    <button className="explain-btn" onClick={() => askTutor({ kind: "explain-command", command: r.code }, `Explain this command: ${r.code}`)} title="Ask the AI tutor to explain this command">
                      <Icon name="llm" />Explain
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="sub-h">Tools professionals use</div>
      <div className="chips">
        {track.tools.map((t) => <span className="chip" key={t}>{t}</span>)}
      </div>

      <StepHead n={5} id="defend" title="Defend against it" sub="Everything above, flipped around: how to stop it on systems you look after." />
      <div className="card">
        <ul className="ticks">
          {track.defend.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </div>

      <div className="sub-h">Keep practising on other legal platforms</div>
      <div className="labs">
        {track.labs.map((l, i) => (
          <div className="lab" key={l.name}>
            <span className="lab-no">0{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              {l.href ? (
                <b><Link href={l.href}>{l.name} →</Link></b>
              ) : (
                <>
                  <b>{l.name}</b>
                  <a className="link" href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.url.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
              <p>{l.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="finish">
        <div className="finish-main">
          <b>{done ? "Track completed" : "Finished this track?"}</b>
          <p>{done ? "Nice work. Move on to the next step, or come back to the lab any time." : "Mark it complete to tick it off on the home page and in the sidebar."}</p>
          <button className={`btn${done ? "" : " primary"}`} onClick={() => toggleDone(slug)}>
            <Icon name={done ? "check" : "circle"} />
            {done ? "Completed — undo" : "Mark track complete"}
          </button>
        </div>
        <div className="finish-nav">
          {prev ? <Link className="btn" href={`/tracks/${prev.slug}`}>← {prev.title}</Link> : <span />}
          {next ? <Link className="btn primary" href={`/tracks/${next.slug}`}>Next: {next.title} →</Link> : <Link className="btn primary" href="/challenges">Try the challenges →</Link>}
        </div>
      </div>
    </>
  );
}
