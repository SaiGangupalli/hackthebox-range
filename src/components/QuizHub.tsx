"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "./icons";
import { Quiz } from "./Quiz";
import { quiz, type Question } from "@/data/quiz";
import { path } from "@/data/path";
import { tracks } from "@/data/tracks";
import { useQuizProgress } from "@/lib/quizProgress";

const MIXED_SIZE = 10;

// Every quiz in one place: pick a track's quiz or a mixed round of random
// questions from all tracks, and take it right here.
export function QuizHub() {
  const bests = useQuizProgress(path.map((p) => p.slug));
  const [active, setActive] = useState<string | null>(null);
  const [mixed, setMixed] = useState<Question[]>([]);
  const [round, setRound] = useState(0);
  const { status } = useSession();
  const [ai, setAi] = useState<{ slug: string; questions: Question[]; backup: boolean } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");

  // Fresh AI-written questions for a track (not saved as your best score).
  async function generate(slug: string) {
    setAiBusy(true);
    setAiErr("");
    try {
      const res = await fetch("/api/ai/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track: slug }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAiErr(data.error ?? "Couldn't generate questions."); return; }
      setAi({ slug, questions: data.questions, backup: !!data.backup });
      setRound((r) => r + 1);
      setActive(`ai:${slug}`);
    } catch {
      setAiErr("Network error — please try again.");
    } finally {
      setAiBusy(false);
    }
  }

  const aiButton = (slug: string) => (
    <div className="ai-gen">
      {status === "authenticated" ? (
        <button className="btn" disabled={aiBusy} onClick={() => generate(slug)}>
          <Icon name="llm" />{aiBusy ? "Writing fresh questions… (about 20 s)" : "Generate 5 fresh questions with AI"}
        </button>
      ) : (
        <span><Icon name="llm" /><Link href="/login">Sign in</Link> to generate fresh AI practice questions.</span>
      )}
      {aiErr && <span className="ai-err">{aiErr}</span>}
    </div>
  );
  const areaRef = useRef<HTMLDivElement>(null);

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
        ) : active.startsWith("ai:") && ai ? (
          <Quiz
            key={`ai-${round}`}
            slug={`ai-${ai.slug}`}
            questions={ai.questions}
            persist={false}
            explainable={false}
            onRetry={() => generate(ai.slug)}
            retryLabel={aiBusy ? "Writing…" : "Generate another round"}
            heading={
              <div className="quizhub-h">
                <h2>{tracks[ai.slug].title} · fresh AI questions</h2>
                <span>practice only — not saved{ai.backup ? " · written by the backup model" : ""} · <button className="task-hintbtn" onClick={() => setActive(ai.slug)}>back to the track quiz</button></span>
              </div>
            }
          />
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
