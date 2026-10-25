"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { Quiz } from "./Quiz";
import type { Question } from "@/data/quiz";
import { CERT_AREAS, CERT_TIERS, type IndustryCert } from "@/data/industryCerts";

// Real-world certifications, filterable by area and level, each with the
// tracks here that prepare you and AI-written practice questions on its topics.
export function CertCatalog({ certs, trackTitles, signedIn }: { certs: IndustryCert[]; trackTitles: Record<string, string>; signedIn: boolean }) {
  const [area, setArea] = useState<string>("All");
  const [tier, setTier] = useState<string>("All");
  const [ai, setAi] = useState<{ cert: IndustryCert; questions: Question[]; backup: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);
  const [round, setRound] = useState(0);
  const practiceRef = useRef<HTMLDivElement>(null);

  const shown = certs.filter((c) => (area === "All" || c.area === area) && (tier === "All" || c.tier === tier));

  async function practise(c: IndustryCert) {
    setBusy(c.id);
    setErr(null);
    try {
      const res = await fetch("/api/ai/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cert: c.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr({ id: c.id, msg: data.error ?? "Couldn't generate questions." }); return; }
      setAi({ cert: c, questions: data.questions, backup: !!data.backup });
      setRound((r) => r + 1);
      requestAnimationFrame(() => practiceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setErr({ id: c.id, msg: "Network error — please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="cc-filters" role="group" aria-label="Filter certifications">
        <div className="cc-row">
          <span className="cc-label">Area</span>
          {["All", ...CERT_AREAS].map((a) => (
            <button key={a} className={`chip-btn${area === a ? " on" : ""}`} onClick={() => setArea(a)}>{a}</button>
          ))}
        </div>
        <div className="cc-row">
          <span className="cc-label">Level</span>
          {["All", ...CERT_TIERS].map((t) => (
            <button key={t} className={`chip-btn${tier === t ? " on" : ""}`} onClick={() => setTier(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div ref={practiceRef}>
        {ai && (
          <div className="cc-practice">
            <Quiz
              key={`cert-${round}`}
              slug={`cert-${ai.cert.id}`}
              questions={ai.questions}
              persist={false}
              explainable={false}
              onRetry={() => practise(ai.cert)}
              retryLabel="5 more questions"
              heading={
                <div className="quizhub-h">
                  <h2>Practice: {ai.cert.name}</h2>
                  <button className="task-hintbtn" onClick={() => setAi(null)}>close</button>
                  <p className="cc-ai-note">
                    Written by AI for this site{ai.backup ? " (backup model)" : ""} to help you revise the certification&apos;s topics — not real exam questions.
                  </p>
                </div>
              }
            />
          </div>
        )}
      </div>

      <p className="cc-count">{shown.length} of {certs.length} certifications</p>
      <div className="cc-grid">
        {shown.map((c) => (
          <article className="cc-card" key={c.id} id={`cert-${c.id}`}>
            <div className="cc-top">
              <span className={`tier ${c.tier.toLowerCase()}`}>{c.tier}</span>
              <span className="cc-area">{c.area}</span>
            </div>
            <h3>{c.name}</h3>
            <div className="cc-provider">{c.provider} · {c.format}</div>
            <p className="cc-proves">{c.proves}</p>
            <p className="cc-for"><b>Good for:</b> {c.goodFor}</p>
            {c.note && <p className="cc-note"><Icon name="flag" />{c.note}</p>}
            <div className="chips cc-topics">{c.topics.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
            {c.prep.length > 0 && (
              <div className="cc-prep">
                <span>Train here:</span>
                {c.prep.map((s) => <Link key={s} href={`/tracks/${s}`}>{trackTitles[s]}</Link>)}
              </div>
            )}
            <div className="cc-actions">
              <a className="btn" href={c.url} target="_blank" rel="noopener noreferrer"><Icon name="resources" />Official page</a>
              {signedIn ? (
                <button className="btn" disabled={busy === c.id} onClick={() => practise(c)}>
                  <Icon name="llm" />{busy === c.id ? "Writing questions… (about 20 s)" : "AI practice questions"}
                </button>
              ) : (
                <span className="cc-signin"><Link href="/login">Sign in</Link> for AI practice questions</span>
              )}
            </div>
            {err?.id === c.id && <p className="ai-err">{err.msg}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
