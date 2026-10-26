"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "./icons";
import { Quiz } from "./Quiz";
import type { Question } from "@/data/quiz";
import { path, pathIndex, LEVELS as PATH_LEVELS } from "@/data/path";
import { tracks } from "@/data/tracks";
import { useQuizProgress } from "@/lib/quizProgress";

const LEVELS = [["auto", "Match each track"], ["Beginner", "Beginner"], ["Intermediate", "Intermediate"], ["Advanced", "Advanced"]] as const;
type Level = (typeof LEVELS)[number][0];
type Settings = { slugs: string[]; level: Level; count: 5 | 10; focus: string };
type Round = { settings: Settings; questions: Question[]; backup: boolean; n: number };
type Result = { correct: number; total: number; missed: Question[] };

const ALL = path.map((p) => p.slug);

// The level a round was really pitched at: "auto" means each track's own
// level, so stepping up or down starts from the hardest of them.
function effectiveLevel(s: Settings) {
  if (s.level !== "auto") return PATH_LEVELS.indexOf(s.level);
  return Math.max(...s.slugs.map((x) => PATH_LEVELS.indexOf(pathIndex[x]?.level ?? "Beginner")));
}

// AI quizzes: Claude writes a fresh round for the tracks, level and length you
// pick (or your weakest quizzes), with an optional focus. After a round you can
// re-test what you missed, step the level up or down, or get another round that
// doesn't repeat this one. Practice only: rounds aren't saved as best scores.
// `preset` starts with those tracks; `compact` (track pages) skips the settings.
export function AiQuiz({ preset, compact = false, autostart = false, onClose }: { preset?: string[]; compact?: boolean; autostart?: boolean; onClose?: () => void }) {
  const { status } = useSession();
  const bests = useQuizProgress(ALL);
  const score = (x: string) => { const b = bests[x]; return b ? b.best / Math.max(1, b.total) : 1; };
  const weak = ALL.filter((x) => score(x) < 1).sort((a, b) => score(a) - score(b)).slice(0, 3);
  const [s, setS] = useState<Settings>({ slugs: preset ?? [], level: "auto", count: 5, focus: "" });
  const [round, setRound] = useState<Round | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState("");
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!busy) return;
    setSecs(0);
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function generate(settings: Settings, extra: { avoid?: Question[]; review?: Question[] } = {}, label = `Writing ${settings.count} questions`) {
    if (!settings.slugs.length) { setErr("Pick at least one track."); return; }
    setBusy(label);
    setErr("");
    try {
      const res = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: settings.slugs, level: settings.level, count: settings.count, focus: settings.focus, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? "Couldn't generate questions."); return; }
      setS(settings);
      setResult(null);
      setRound((r) => ({ settings, questions: data.questions, backup: !!data.backup, n: (r?.n ?? 0) + 1 }));
      requestAnimationFrame(() => areaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (autostart && status === "authenticated" && !started.current && s.slugs.length) { started.current = true; generate(s); }
  }, [autostart, status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== "authenticated") {
    return (
      <div className="ai-gen">
        <span><Icon name="llm" />{status === "loading" ? "…" : <><Link href="/login">Sign in</Link> to take quizzes written fresh by AI.</>}</span>
      </div>
    );
  }

  const toggle = (slug: string) => setS((x) => ({ ...x, slugs: x.slugs.includes(slug) ? x.slugs.filter((y) => y !== slug) : [...x.slugs, slug] }));
  const working = busy && <span className="aiq-busy" role="status"><span className="aiq-spin" aria-hidden />{busy}… {secs}s</span>;
  const errLine = err && <span className="ai-err" role="alert">{err}</span>;

  const builder = compact ? (
    <div className="ai-gen">
      <button className="btn" disabled={!!busy} onClick={() => generate(s)}><Icon name="llm" />Generate {s.count} fresh questions with AI</button>
      {working}{errLine}
    </div>
  ) : (
    <div className="aiq-builder">
      <div className="cc-row" role="group" aria-label="Tracks">
        <span className="cc-label">Tracks</span>
        <button className={`chip-btn${s.slugs.length === ALL.length ? " on" : ""}`} aria-pressed={s.slugs.length === ALL.length} onClick={() => setS((x) => ({ ...x, slugs: x.slugs.length === ALL.length ? [] : ALL }))}>All tracks</button>
        <button className="chip-btn" disabled={!weak.length} title={weak.length ? weak.map((x) => tracks[x].title).join(", ") : "Take a track quiz first — this picks the ones you scored lowest on."} onClick={() => setS((x) => ({ ...x, slugs: weak }))}>
          <Icon name="zap" />My weak spots
        </button>
        {ALL.map((slug) => (
          <button key={slug} className={`chip-btn${s.slugs.includes(slug) ? " on" : ""}`} aria-pressed={s.slugs.includes(slug)} onClick={() => toggle(slug)}>{tracks[slug].title}</button>
        ))}
      </div>
      <div className="cc-row" role="group" aria-label="Level">
        <span className="cc-label">Level</span>
        {LEVELS.map(([v, label]) => (
          <button key={v} className={`chip-btn${s.level === v ? " on" : ""}`} aria-pressed={s.level === v} onClick={() => setS((x) => ({ ...x, level: v }))}>{label}</button>
        ))}
      </div>
      <div className="cc-row" role="group" aria-label="Number of questions">
        <span className="cc-label">Length</span>
        {([5, 10] as const).map((n) => (
          <button key={n} className={`chip-btn${s.count === n ? " on" : ""}`} aria-pressed={s.count === n} onClick={() => setS((x) => ({ ...x, count: n }))}>{n} questions</button>
        ))}
      </div>
      <div className="cc-row">
        <label className="cc-label" htmlFor="aiq-focus">Focus</label>
        <input id="aiq-focus" className="aiq-focus" maxLength={80} value={s.focus} placeholder="optional — e.g. Wireshark filters, JWT attacks, phishing emails" onChange={(e) => setS((x) => ({ ...x, focus: e.target.value }))} />
      </div>
      <div className="aiq-go">
        <button className="btn primary" disabled={!!busy || !s.slugs.length} onClick={() => generate(s)}><Icon name="llm" />Generate {s.count} questions</button>
        {working || <span className="aiq-sum">{s.slugs.length ? `${s.slugs.length === ALL.length ? "every track" : s.slugs.length === 1 ? tracks[s.slugs[0]].title : `${s.slugs.length} tracks`} · ${LEVELS.find(([v]) => v === s.level)![1].toLowerCase()}${s.focus.trim() ? ` · focus: ${s.focus.trim()}` : ""}` : "Pick at least one track."}</span>}
        {errLine}
      </div>
    </div>
  );

  if (!round) {
    return (
      <div className="aiq">
        {!compact && (
          <div className="quizhub-h">
            <h2>AI quiz</h2>
            <span>Fresh questions written by AI each time — concepts, scenarios and logs to read. Practice only, not saved.{onClose && <> · <button className="task-hintbtn" onClick={onClose}>close</button></>}</span>
          </div>
        )}
        {builder}
      </div>
    );
  }

  const lv = effectiveLevel(round.settings);
  const harder = PATH_LEVELS[lv + 1], easier = PATH_LEVELS[lv - 1];
  const pct = result ? result.correct / Math.max(1, result.total) : 0;
  const scope = round.settings.slugs.length === ALL.length ? "Every track" : round.settings.slugs.map((x) => tracks[x].title).join(", ");
  const followUps = result && (busy ? working : (
    <>
      {result.missed.length > 0 && (
        <button className="btn" onClick={() => generate(round.settings, { review: result.missed, avoid: round.questions }, "Writing questions on what you missed")}>
          <Icon name="book" />Practise what I missed ({result.missed.length})
        </button>
      )}
      {pct >= 0.8 && harder && <button className="btn" onClick={() => generate({ ...round.settings, level: harder }, { avoid: round.questions }, `Writing ${harder} questions`)}><Icon name="zap" />Go harder: {harder}</button>}
      {pct <= 0.4 && easier && <button className="btn" onClick={() => generate({ ...round.settings, level: easier }, { avoid: round.questions }, `Writing ${easier} questions`)}>Make it easier: {easier}</button>}
      {!compact && <button className="task-hintbtn" onClick={() => { setRound(null); setResult(null); }}>change settings</button>}
      {errLine}
    </>
  ));

  return (
    <div className="aiq" ref={areaRef}>
      <Quiz
        key={`ai-${round.n}`}
        slug={`ai-${round.n}`}
        questions={round.questions}
        persist={false}
        onFinish={setResult}
        onRetry={() => !busy && generate(round.settings, { avoid: round.questions })}
        retryLabel={busy ? "Writing…" : "Another round"}
        actions={followUps}
        heading={
          <div className="quizhub-h">
            <h2>{compact ? "Fresh AI questions" : `AI quiz · ${scope}`}</h2>
            <span>
              {round.settings.level === "auto" ? "each track's level" : round.settings.level}{round.settings.focus ? ` · focus: ${round.settings.focus}` : ""} · practice only, not saved{round.backup ? " · written by the backup model" : ""}
              {!compact && <> · <button className="task-hintbtn" onClick={() => { setRound(null); setResult(null); }}>change settings</button></>}
              {onClose && <> · <button className="task-hintbtn" onClick={onClose}>close</button></>}
            </span>
          </div>
        }
      />
      {!result && (working || errLine) && <div className="ai-gen">{working}{errLine}</div>}
    </div>
  );
}
