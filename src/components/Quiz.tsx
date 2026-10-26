"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";
import { quiz, type Question } from "@/data/quiz";
import { saveQuiz, useQuizProgress } from "@/lib/quizProgress";
import { askTutor } from "@/lib/tutor";

// Stable string hash, so options shuffle the same way on server and client.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const LETTERS = "ABCD";
// Within a track each question puts its answer in a different slot (a fixed
// permutation, offset per track), so there's no "it's always C" pattern.
const SLOT_ORDER = [0, 2, 1, 3];

// "Check your understanding": pick an answer to see straight away whether it's
// right and why. Your best score is kept and shown on the home page. Pass
// `questions` to quiz on a custom set (the mixed round, AI rounds); `slug` then
// just keys the shuffle and the saved best score. `onRetry` replaces "Try
// again", `actions` adds buttons beside it, and `onFinish` hears the result.
export function Quiz({ slug, heading, questions: given, onRetry, retryLabel = "Try again", persist = true, explainable = true, actions, onFinish }: {
  slug: string;
  heading?: React.ReactNode;
  questions?: Question[];
  onRetry?: () => void;
  retryLabel?: string;
  persist?: boolean; // false: don't save a best score (AI-generated rounds)
  explainable?: boolean; // false: hide "Explain more" (AI questions also need the server's signature)
  actions?: React.ReactNode;
  onFinish?: (result: { correct: number; total: number; missed: Question[] }) => void;
}) {
  const questions = given ?? quiz[slug];
  const shuffled = useMemo(
    () => (questions ?? []).map((q, i) => {
      const opts = [...q.wrong].sort((a, b) => hash(q.q + a) - hash(q.q + b));
      opts.splice((hash(slug) + SLOT_ORDER[i % 4]) % (q.wrong.length + 1), 0, q.right);
      return opts;
    }),
    [questions, slug],
  );
  const [picked, setPicked] = useState<(number | null)[]>(() => (questions ?? []).map(() => null));
  const best = useQuizProgress([slug])[slug];

  const total = questions?.length ?? 0;
  const answered = picked.filter((p) => p !== null).length;
  const correct = picked.filter((p, i) => p !== null && shuffled[i][p] === questions[i].right).length;
  const finished = total > 0 && answered === total;

  useEffect(() => { if (finished && persist) saveQuiz(slug, correct, total); }, [finished, correct, total, slug, persist]);
  useEffect(() => {
    if (finished) onFinish?.({ correct, total, missed: questions.filter((q, i) => shuffled[i][picked[i]!] !== q.right) });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!questions?.length) return null;

  const verdict =
    correct === total ? "Perfect score — you've got this." :
    correct >= total - 1 ? "Nearly there. Re-read the explanation for the one you missed." :
    "Worth another look at Step 1, then try again.";

  return (
    <>
      {heading}
      <div className="quiz">
        <div className="quiz-top">
          <span>{answered}/{total} answered</span>
          <span className="quiz-ok">{correct} correct</span>
          {best && <span className="quiz-best"><Icon name="trophy" />best {best.best}/{best.total}</span>}
        </div>

        {questions.map((q, i) => {
          const p = picked[i];
          const done = p !== null;
          const right = done && shuffled[i][p] === q.right;
          return (
            <div className={`qz${done ? (right ? " right" : " wrong") : ""}`} key={q.q}>
              <div className="qz-q"><span className="qz-n">{i + 1}</span><span>{q.q}</span></div>
              {q.snippet && <pre className="qz-snippet">{q.snippet}</pre>}
              <div className="qz-opts" role="group" aria-label={`Question ${i + 1} options`}>
                {shuffled[i].map((opt, k) => {
                  const isRight = opt === q.right;
                  const cls = !done ? "" : isRight ? " is-right" : k === p ? " is-wrong" : " dim";
                  return (
                    <button
                      key={opt}
                      className={`qz-opt${cls}`}
                      disabled={done}
                      aria-pressed={k === p}
                      onClick={() => setPicked((ps) => ps.map((x, j) => (j === i ? k : x)))}
                    >
                      <span className="qz-l">{done && isRight ? <Icon name="check" /> : LETTERS[k]}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {done && (
                <div className={`qz-why ${right ? "ok" : "no"}`}>
                  <b>{right ? "Correct." : `Not quite — the answer is “${q.right}”.`}</b> {q.why}
                  {explainable && (
                    <button className="task-hintbtn tutor-link" onClick={() => askTutor({ kind: "quiz-explain", question: q.q, picked: shuffled[i][p!], ...(q.sig ? { ai: q } : {}) }, `Explain more: “${q.q}” — I picked “${shuffled[i][p!]}”.`)}>
                      <Icon name="llm" />Explain more with the tutor
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {finished && (
          <div className={`quiz-result${correct === total ? " perfect" : ""}`}>
            <div className="quiz-score">{correct}/{total}</div>
            <div>
              <b>{verdict}</b>
              <div className="quiz-actions">
                <button className="btn" onClick={() => (onRetry ? onRetry() : setPicked(questions.map(() => null)))}>{retryLabel}</button>
                {actions}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
