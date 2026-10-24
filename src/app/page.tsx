"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { tracks } from "@/data/tracks";
import { path } from "@/data/path";
import { Icon } from "@/components/icons";
import { useProgress } from "@/lib/progress";
import { useLabProgress } from "@/lib/labProgress";
import { useQuizProgress } from "@/lib/quizProgress";
import { ActivityFeed } from "@/components/ActivityFeed";

const HOW: [string, string, string][] = [
  ["book", "Understand", "Each track opens with plain-English explanations and worked examples."],
  ["zap", "Practise", "Try it in a safe in-browser simulator, guided by objectives and hints."],
  ["trophy", "Check", "Four quick questions confirm you've understood — with explanations."],
  ["resources", "Reference", "Commands and tools in one place — plus a printable cheatsheet."],
  ["shield", "Defend", "Every attack is paired with how to stop it on systems you look after."],
];

export default function Home() {
  const { map, count } = useProgress();
  const lab = useLabProgress(path.map((p) => p.labId));
  const qz = useQuizProgress(path.map((p) => p.slug));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDone = (slug: string) => mounted && !!map[slug];
  const nextStep = path.find((p) => !isDone(p.slug)) ?? path[0];
  const started = mounted && count > 0;

  return (
    <>
      <section className="hero">
        <div className="hero-tag">// VICS SECURITY CONCLAVE 2026 · CAPTURE THE FLAG</div>
        <h1>Learn to break it,<br />so you can <span className="mono">def3nd</span> it.</h1>
        <p>
          A guided, hands-on range for the nine H@ck1h3B0x tracks. No experience needed: follow the path below,
          read the short explanations, then practise each skill in a safe simulator right here in your browser.
        </p>
        <div className="try-row">
          <Link className="btn primary" href={`/tracks/${nextStep.slug}`}>
            <Icon name="zap" />{started ? `Continue: ${tracks[nextStep.slug].title}` : "Start the learning path"}
          </Link>
          <Link className="btn" href="/cheatsheet"><Icon name="book" />Cheatsheet (PDF)</Link>
          <Link className="btn" href="/ethics"><Icon name="shield" />Rules of engagement</Link>
        </div>
        <div className="statline">
          <span><b>9</b>guided tracks</span>
          <span><b>9</b>hands-on labs</span>
          <span><b>10+10</b>OWASP risks</span>
          <span><b>100%</b>in your browser</span>
        </div>
      </section>

      <div className="callout warn" style={{ marginBottom: 22 }}>
        <Icon name="shield" />
        <div>
          <b>Authorized use only.</b> Every technique here is for CTF, your own lab, or systems you have
          written permission to test. <Link href="/ethics">Read the rules of engagement</Link> before you touch a target.
        </div>
      </div>

      <div className="sec-h"><Icon name="book" />How each track works</div>
      <div className="how-strip">
        {HOW.map(([icon, title, text], i) => (
          <div className="how-step" key={title}>
            <span className="how-n">{i + 1}</span>
            <Icon name={icon} />
            <b>{title}</b>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="path-head">
        <div className="sec-h" style={{ margin: 0 }}><Icon name="flag" />Your learning path</div>
        <span className="path-count">{mounted ? count : 0}/{path.length} tracks complete</span>
      </div>
      <div className="bar path-bar"><i style={{ width: `${((mounted ? count : 0) / path.length) * 100}%` }} /></div>

      <ol className="path">
        {path.map((p, i) => {
          const t = tracks[p.slug];
          const done = isDone(p.slug);
          const lp = lab[p.labId];
          const current = p.slug === nextStep.slug && !done;
          return (
            <li className={`path-step${done ? " done" : ""}${current ? " current" : ""}`} key={p.slug}>
              <span className="path-n">{done ? <Icon name="check" /> : i + 1}</span>
              <div className="path-body">
                <div className="path-top">
                  <Link href={`/tracks/${p.slug}`} className="path-title">{t.title}</Link>
                  <span className={`lvl ${p.level.toLowerCase()}`}>{p.level}</span>
                  <span className="path-min">{p.minutes} min</span>
                  {lp && lp.total > 0 && <span className="path-lab">lab {lp.done}/{lp.total}</span>}
                  {qz[p.slug] && <span className="path-lab">quiz {qz[p.slug]!.best}/{qz[p.slug]!.total}</span>}
                </div>
                <p>{p.why}</p>
              </div>
              <Link className={`btn${current ? " primary" : ""} path-go`} href={`/tracks/${p.slug}`}>
                {done ? "Review" : current ? "Start" : "Open"}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="sec-h"><Icon name="zap" />Happening now</div>
      <ActivityFeed limit={8} />

      <div className="callout info" style={{ marginTop: 22 }}>
        <Icon name="trophy" />
        <div>
          Finished the path? Test yourself on the <Link href="/challenges">challenges</Link> and climb the{" "}
          <Link href="/scoreboard">scoreboard</Link>. The <Link href="/owasp">OWASP Web</Link> and{" "}
          <Link href="/llm">LLM Top 10</Link> pages go deeper, with examples and live labs.
        </div>
      </div>
    </>
  );
}
