"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "./icons";
import { Quiz } from "./Quiz";
import { AiQuiz } from "./AiQuiz";
import { quiz, type Question } from "@/data/quiz";
import { path } from "@/data/path";
import { tracks } from "@/data/tracks";
import { useQuizProgress } from "@/lib/quizProgress";

const MIXED_SIZE = 10;

// Every quiz in one place: pick a track's quiz, a mixed round of random
// questions from all tracks, or an AI quiz written fresh for the tracks, level
// and focus you choose, and take it right here.
export function QuizHub() {
  const bests = useQuizProgress(path.map((p) => p.slug));
  const [active, setActive] = useState<string | null>(null);
  const [mixed, setMixed] = useState<Question[]>([]);
  const [round, setRound] = useState(0);
  const { status } = useSession();
  const [ai, setAi] = useState<{ preset: string[] | undefined; autostart: boolean; n: number }>({ preset: undefined, autostart: false, n: 0 });
  const areaRef = useRef<HTMLDivElement>(null);

  // The AI quiz, optionally starting straight away on one track's questions.
  function openAi(preset?: string[]) {
    setAi((a) => ({ preset, autostart: !!preset, n: a.n + 1 }));
    setActive("ai");
    requestAnimationFrame(() => areaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const aiButton = (slug: string) => (
    <div className="ai-gen">
      {status === "authenticated" ? (
        <button className="btn" onClick={() => openAi([slug])}><Icon name="llm" />Generate fresh questions with AI</button>
      ) : (
        <span><Icon name="llm" /><Link href="/login">Sign in</Link> to generate fresh AI practice questions.</span>
      )}
    </div>
  );

  const totalQ = path.reduce((s, p) => s + (quiz[p.slug]?.length ?? 0), 0);
  const bestSum = path.reduce((s, p) => s + (bests[p.slug]?.best ?? 0), 0);
  const perfect = path.filter((p) => { const b = bests[p.slug]; return b && b.best >= (quiz[p.slug]?.length ?? Infinity); }).length;

  function newMixed() {
    const all = path.flatMap((p) => quiz[p.slug] ?? []);
    const pick = [...all].sort(() => Math.random() - 0.5).slice(0, MIXED_SIZE);
    setMixed(pick);
    setRound((r) => r + 1);
  }

  function open(slug: string) {
    if (slug === "mixed") newMixed();
    setActive(slug);
    requestAnimationFrame(() => areaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <>
      <div className="quizhub-summary">
        <div><b>{bestSum}<i>/{totalQ}</i></b><span>best answers across all quizzes</span></div>
        <div><b>{perfect}<i>/{path.length}</i></b><span>quizzes at full marks</span></div>
        <div className="bar"><i style={{ width: `${(bestSum / Math.max(1, totalQ)) * 100}%` }} /></div>
      </div>

      <div className="quizhub-grid">
        <button className={`qh-card mixed${active === "mixed" ? " on" : ""}`} onClick={() => open("mixed")}>
          <span className="qh-top"><Icon name="zap" /><span className="qh-n">mix</span></span>
          <b>Mixed round</b>
          <small>{MIXED_SIZE} random questions from every track — a new set each time.</small>
          <span className="qh-go">Start a round →</span>
        </button>
        <button className={`qh-card ai${active === "ai" ? " on" : ""}`} onClick={() => openAi()}>
          <span className="qh-top"><Icon name="llm" /><span className="qh-n">ai</span></span>
          <b>AI quiz</b>
          <small>Fresh questions every time: pick tracks, level, length and a focus — or your weak spots.</small>
          <span className="qh-go">Build a quiz →</span>
        </button>
        {path.map((p, i) => {
          const n = quiz[p.slug]?.length ?? 0;
          const b = bests[p.slug];
          const pct = b ? (b.best / n) * 100 : 0;
          return (
            <button key={p.slug} className={`qh-card${active === p.slug ? " on" : ""}${b && b.best >= n ? " perfect" : ""}`} onClick={() => open(p.slug)}>
              <span className="qh-top"><Icon name={p.slug} /><span className="qh-n">{String(i + 1).padStart(2, "0")}</span></span>
              <b>{tracks[p.slug].title}</b>
              <small>{n} questions · {p.level}</small>
              <span className="mini-bar wide"><i style={{ width: `${pct}%` }} /></span>
              <span className="qh-go">{b ? `best ${b.best}/${n} · retake →` : "Start →"}</span>
            </button>
          );
        })}
      </div>

      <div ref={areaRef} className="quizhub-area">
        {active === null ? (
          <p className="quizhub-hint"><Icon name="book" />Pick a quiz above. Each answer tells you straight away whether you were right — and why.</p>
        ) : active === "mixed" ? (
          <Quiz
            key={`mixed-${round}`}
            slug="mixed"
            questions={mixed}
            onRetry={newMixed}
            retryLabel="New round"
            heading={<div className="quizhub-h"><h2>Mixed round</h2><button className="task-hintbtn" onClick={() => setActive(null)}>close</button></div>}
          />
        ) : active === "ai" ? (
          <AiQuiz key={ai.n} preset={ai.preset} autostart={ai.autostart} onClose={() => setActive(null)} />
        ) : (
          <Quiz
            key={active}
            slug={active}
            heading={
              <div className="quizhub-h">
                <h2>{tracks[active].title} quiz</h2>
                <span><Link href={`/tracks/${active}`}>Review the track</Link> · <button className="task-hintbtn" onClick={() => setActive(null)}>close</button></span>
                {aiButton(active)}
              </div>
            }
          />
        )}
      </div>
    </>
  );
}
