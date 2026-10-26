"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { LocalTime } from "./LocalTime";
import { studyId, type RangeCert } from "@/data/certify";
import type { CertStatus, ExamResult, PublicQ, ReqItem } from "@/lib/certify/exam";

type Running = { questions: PublicQ[]; deadline: number; offset: number };

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The exam flow: requirements and rules → timed questions → result. Questions
// and grading come from the server; answers are kept in this browser while you
// work so a reload doesn't lose them (the timer keeps running on the server).
export function ExamRunner({ cert, status, reqs, signedIn, retryMinutes }: { cert: RangeCert; status: CertStatus | null; reqs: ReqItem[]; signedIn: boolean; retryMinutes: number }) {
  const [run, setRun] = useState<Running | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  // The study-guide topic an exam topic belongs to, so a weak result links to what to revise.
  const studyFor = (examTopic: string) => cert.study.find((t) => t.exam.includes(examTopic))?.topic;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [retryAt, setRetryAt] = useState<number | null>(status?.retryAt ?? null);
  const submitted = useRef(false);
  const store = run ? `hhb_exam_${cert.id}_${run.deadline}` : null;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!store) return;
    try { setAnswers(JSON.parse(localStorage.getItem(store) ?? "{}")); } catch { /* storage blocked */ }
  }, [store]);

  function choose(qid: string, opt: string) {
    setAnswers((a) => {
      const next = { ...a, [qid]: opt };
      if (store) { try { localStorage.setItem(store, JSON.stringify(next)); } catch { /* ignore */ } }
      return next;
    });
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/certify/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cert: cert.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Couldn't start the exam."); if (data.retryAt) setRetryAt(data.retryAt); return; }
      submitted.current = false;
      setResult(null);
      setRun({ questions: data.questions, deadline: data.deadline, offset: data.now - Date.now() });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const submit = useCallback(async () => {
    if (!run || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/certify/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cert: cert.id, answers }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Couldn't submit the exam."); submitted.current = false; return; }
      setResult(data as ExamResult);
      if (data.retryAt) setRetryAt(data.retryAt);
      if (store) { try { localStorage.removeItem(store); } catch { /* ignore */ } }
      setRun(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network error — your answers are still here. Try submitting again.");
      submitted.current = false;
    } finally {
      setBusy(false);
    }
  }, [run, answers, cert.id, store]);

  // Submit automatically when time runs out.
  const left = run ? run.deadline - (now + run.offset) : 0;
  useEffect(() => {
    if (run && left <= 0) submit();
  }, [run, left, submit]);

  // ── Result ───────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className={`exam-result ${result.passed ? "pass" : "fail"}`}>
        <div className="er-head">
          <Icon name={result.passed ? "cert" : "flag"} />
          <div>
            <h2>{result.passed ? "You passed — certified!" : result.late ? "Time ran out" : "Not this time"}</h2>
            <p>You scored <b>{result.score}/{result.total}</b> ({result.pct}%). The pass mark is {result.pass}%.</p>
          </div>
        </div>
        {result.passed && result.code ? (
          <div className="er-cert">
            <p>Your certificate code is <code>{result.code}</code>. It&apos;s on your profile, and anyone can verify it at its own page.</p>
            <Link className="btn primary" href={`/cert/${result.code}`}><Icon name="cert" />View and share your certificate</Link>
          </div>
        ) : (
          <p className="er-retry">
            {retryAt ? <>You can try again after <b><LocalTime at={retryAt} format="time" /></b> ({retryMinutes} minutes). </> : null}
            Use the time to revisit your weakest topics below — each links to its part of the study guide.
          </p>
        )}
        <h3>By topic</h3>
        <ul className="er-topics">
          {result.topics.map((t) => (
            <li key={t.topic} className={t.correct === t.total ? "ok" : t.correct / t.total < 0.5 ? "weak" : ""}>
              {studyFor(t.topic) ? <a href={`#${studyId(studyFor(t.topic)!)}`}>{t.topic}</a> : <span>{t.topic}</span>}<b>{t.correct}/{t.total}</b>
            </li>
          ))}
        </ul>
        {result.review && (
          <details className="er-review" open>
            <summary>Review every question</summary>
            <ol>
              {result.review.map((r, i) => (
                <li key={i} className={r.yours === r.right ? "ok" : "miss"}>
                  <p className="er-q"><InlineCode text={r.q} /></p>
                  <p><b>Answer:</b> {r.right}{r.yours !== r.right && <> · <span className="er-yours">you chose: {r.yours ?? "no answer"}</span></>}</p>
                  <p className="er-why">{r.why}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
        {!result.passed && <p><Link className="btn" href="/certifications">Back to certifications</Link></p>}
      </div>
    );
  }

  // ── Running ──────────────────────────────────────────────────────────────
  if (run) {
    const done = run.questions.filter((q) => answers[q.id]).length;
    return (
      <div className="exam">
        <div className={`exam-bar${left < 120_000 ? " hurry" : ""}`}>
          <span className="exam-time"><Icon name="circle" />{fmtTime(left)} left</span>
          <span className="exam-progress">{done}/{run.questions.length} answered</span>
          <div className="bar"><i style={{ width: `${(done / run.questions.length) * 100}%` }} /></div>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => { if (done === run.questions.length || confirm(`You've answered ${done} of ${run.questions.length}. Submit anyway?`)) submit(); }}
          >
            {busy ? "Submitting…" : "Submit answers"}
          </button>
        </div>
        {error && <p className="ai-err">{error}</p>}
        <ol className="exam-qs">
          {run.questions.map((q, i) => (
            <li key={q.id} className={`exam-q${answers[q.id] ? " answered" : ""}`}>
              <p className="exam-qt"><span>{i + 1}</span><span className="exam-qtext"><InlineCode text={q.q} /></span></p>
              <div className="exam-opts" role="radiogroup" aria-label={`Question ${i + 1}`}>
                {q.options.map((o) => (
                  <button key={o} role="radio" aria-checked={answers[q.id] === o} className={`exam-opt${answers[q.id] === o ? " on" : ""}`} onClick={() => choose(q.id, o)}>
                    <span className="exam-dot" />{o}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
        <p className="exam-foot">Leaving this page doesn&apos;t stop the clock — come back to resume where you left off.</p>
      </div>
    );
  }

  // ── Intro ────────────────────────────────────────────────────────────────
  const waiting = retryAt && retryAt > now;
  return (
    <div className="exam-intro">
      <div className="rc-exam big">
        <span><Icon name="book" />{cert.exam.questions} questions, drawn at random</span>
        <span><Icon name="circle" />{cert.exam.minutes} minutes</span>
        <span><Icon name="trophy" />pass mark {cert.exam.pass}%</span>
      </div>

      <div className="exam-cols">
        <div className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Requirements</div>
          <ul className="rc-reqs">
            {reqs.map((r) => (
              <li key={r.label} className={status && r.met ? "met" : ""}>
                <Icon name={status && r.met ? "check" : "circle"} />
                {r.href ? <Link href={r.href}>{r.label}</Link> : r.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>What the exam covers</div>
          <div className="chips">{cert.covers.map((x) => <span className="chip" key={x}>{x}</span>)}</div>
          <div className="sub-h">How it works</div>
          <ul className="ticks">
            <li>One attempt at a time; the timer runs on the server, so leaving the page doesn&apos;t pause it.</li>
            <li>Answer in any order, then submit — it also submits itself when time runs out.</li>
            <li>Not this time? You&apos;ll see your score by topic and can retry after {retryMinutes} minutes.</li>
            <li>Pass and you&apos;ll get a full review, a certificate code and a page anyone can verify.</li>
          </ul>
        </div>
      </div>

      {error && <p className="ai-err">{error}</p>}
      <div className="exam-start">
        {!signedIn ? (
          <><Link className="btn primary" href="/login">Sign in to take the exam</Link><span>or <Link href="/register">create a handle</Link></span></>
        ) : status?.earned ? (
          <Link className="btn primary" href={`/cert/${status.earned.code}`}><Icon name="cert" />You&apos;re certified — view your certificate</Link>
        ) : !status?.ready ? (
          <><button className="btn" disabled>Finish the requirements first</button><span>Each item above links to where you can complete it.</span></>
        ) : waiting ? (
          <><button className="btn" disabled>Retry available at <LocalTime at={retryAt!} format="time" /></button><span>Review the topics you missed in the meantime.</span></>
        ) : (
          <><button className="btn primary" disabled={busy} onClick={start}><Icon name="zap" />{status?.inProgress ? "Resume the exam" : busy ? "Starting…" : "Start the exam"}</button>
            {status && status.attempts > 0 && <span>Attempts so far: {status.attempts}{status.best != null ? ` · best ${status.best}%` : ""}</span>}</>
        )}
      </div>
    </div>
  );
}
