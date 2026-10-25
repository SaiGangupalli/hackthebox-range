"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { tracks } from "@/data/tracks";
import { path, LEVELS, type Level } from "@/data/path";
import { quiz } from "@/data/quiz";
import { labById } from "@/data/labs";
import { drills, DOJO_ID, levelTier } from "@/data/drills";
import { useProgress } from "@/lib/progress";
import { useLabProgress, loadLab, onLabChange } from "@/lib/labProgress";
import { useQuizProgress } from "@/lib/quizProgress";
import { cards } from "@/data/cards";
import { countDue, useReviewState } from "@/lib/review";

export type ChallengeSummary = { id: string; title: string; track: string; points: number; level: string | null };
export type CertSummary = { id: string; code: string; name: string; level: Level; earned: string | null; ready: boolean; met: number; total: number; next: { label: string; href?: string } | null };

const slugByTitle: Record<string, string> = Object.fromEntries(Object.values(tracks).map((t) => [t.title, t.slug]));

// "What should I do next?" in one place: the next step on the path, progress by
// level, what to review, command practice, certification readiness and
// challenges that match what you've learned.
export function MyLearning({ handle, challenges, solved, certs, dbError }: { handle: string | null; challenges: ChallengeSummary[]; solved: string[]; certs: CertSummary[] | null; dbError: boolean }) {
  const { map } = useProgress();
  const labs = useLabProgress(path.map((p) => p.labId));
  const quizzes = useQuizProgress(path.map((p) => p.slug));
  const [dojo, setDojo] = useState<boolean[]>([]);
  const fcState = useReviewState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const load = () => setDojo(loadLab(DOJO_ID, drills.length));
    load();
    return onLabChange(DOJO_ID, load);
  }, []);
  if (!mounted) return <div className="ml-loading">Loading your progress…</div>;

  // Per-track status from what's saved in this browser.
  const rows = path.map((p) => {
    const lab = labById[p.labId];
    const labDone = Math.min(labs[p.labId]?.done ?? 0, lab?.objectives ?? 0);
    const labTotal = lab?.objectives ?? 0;
    const q = quizzes[p.slug];
    const qTotal = quiz[p.slug]?.length ?? 0;
    const done = !!map[p.slug];
    const started = done || labDone > 0 || !!q;
    return { p, t: tracks[p.slug], labDone, labTotal, qBest: q?.best ?? null, qTotal, done, started };
  });
  const next = rows.find((r) => !r.done && r.started) ?? rows.find((r) => !r.done) ?? null;
  const doneCount = rows.filter((r) => r.done).length;
  const objectives = rows.reduce((s, r) => s + r.labDone, 0);
  const objectivesTotal = rows.reduce((s, r) => s + r.labTotal, 0);
  const quizRight = rows.reduce((s, r) => s + (r.qBest ?? 0), 0);
  const quizTotal = rows.reduce((s, r) => s + r.qTotal, 0);

  const review = [
    ...rows.filter((r) => r.qBest !== null && r.qBest < r.qTotal).map((r) => ({ key: `q-${r.p.slug}`, href: `/tracks/${r.p.slug}#check`, text: `Retake the ${r.t.title} quiz`, note: `best ${r.qBest}/${r.qTotal}`, weight: (r.qBest ?? 0) / Math.max(1, r.qTotal) })),
    ...rows.filter((r) => r.labDone > 0 && r.labDone < r.labTotal).map((r) => ({ key: `l-${r.p.slug}`, href: `/tracks/${r.p.slug}#practice`, text: `Finish the ${r.t.title} lab`, note: `${r.labDone}/${r.labTotal} objectives`, weight: r.labDone / Math.max(1, r.labTotal) })),
    ...rows.filter((r) => !r.done && r.labTotal > 0 && r.labDone === r.labTotal && r.qBest === r.qTotal).map((r) => ({ key: `d-${r.p.slug}`, href: `/tracks/${r.p.slug}`, text: `Mark ${r.t.title} complete`, note: "lab and quiz done", weight: 1 })),
  ].sort((a, b) => a.weight - b.weight).slice(0, 6);

  // Command practice by tier.
  const tiers = LEVELS.map((lv) => {
    const ids = drills.map((d, i) => (levelTier(d.level) === lv ? i : -1)).filter((i) => i >= 0);
    return { lv, done: ids.filter((i) => dojo[i]).length, total: ids.length };
  });
  const drillsDone = dojo.filter(Boolean).length;

  // Challenges that match what you've learned: unsolved, from the warm-up or a
  // track you've finished (or the one you're on), easiest first.
  const solvedSet = new Set(solved);
  const learned = new Set([...rows.filter((r) => r.done).map((r) => r.p.slug), ...(next ? [next.p.slug] : [])]);
  const suggest = challenges
    .filter((c) => !solvedSet.has(c.id) && (c.track === "Warm-up" || learned.has(slugByTitle[c.track])))
    .sort((a, b) => a.points - b.points)
    .slice(0, 4);
  const points = challenges.filter((c) => solvedSet.has(c.id)).reduce((s, c) => s + c.points, 0);
  const fc = countDue(cards.map((c) => c.id), fcState);

  return (
    <>
      <div className="eyebrow"><Icon name="trophy" />my learning</div>
      <h1 className="view-title">{handle ? `Welcome back, ${handle}` : "My learning"}</h1>
      <p className="lede">Your progress in one place, and what to do next. {handle ? "Progress syncs to your account." : <>Progress is saved in this browser — <Link href="/login">sign in</Link> to keep it everywhere and to see challenges and certifications.</>}</p>
      {dbError && <div className="callout warn" style={{ marginBottom: 14 }}><Icon name="shield" /><div>Challenge and certification data couldn&apos;t be loaded right now — your learning progress below is still accurate.</div></div>}

      <div className="ml-stats">
        <div><b>{doneCount}<i>/{rows.length}</i></b><span>tracks complete</span></div>
        <div><b>{objectives}<i>/{objectivesTotal}</i></b><span>lab objectives</span></div>
        <div><b>{quizRight}<i>/{quizTotal}</i></b><span>best quiz answers</span></div>
        <div><b>{drillsDone}<i>/{drills.length}</i></b><span>command drills</span></div>
        {handle && <div><b>{solved.length}<i>/{challenges.length}</i></b><span>challenges · {points} pts</span></div>}
      </div>

      {next ? (
        <section className="ml-next">
          <div className="ml-next-h"><Icon name="zap" />Up next</div>
          <div className="ml-next-body">
            <div>
              <div className="ml-next-title"><Link href={`/tracks/${next.p.slug}`}>{next.t.title}</Link> <span className={`lvl ${next.p.level.toLowerCase()}`}>{next.p.level}</span></div>
              <p>{next.p.why}</p>
              <div className="ml-next-meta">
                <span>about {next.p.minutes} min</span>
                {next.labTotal > 0 && <span>lab {next.labDone}/{next.labTotal}</span>}
                <span>quiz {next.qBest ?? 0}/{next.qTotal}</span>
              </div>
            </div>
            <Link className="btn primary" href={`/tracks/${next.p.slug}${next.labDone > 0 ? "#practice" : ""}`}>{next.started ? "Continue" : "Start"} →</Link>
          </div>
        </section>
      ) : (
        <div className="callout info"><Icon name="trophy" /><div><b>Every track complete!</b> Earn your <Link href="/certifications">certifications</Link> and take on the advanced <Link href="/challenges">challenges</Link>.</div></div>
      )}

      <div className="ml-grid">
        <section className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Progress by level</div>
          {LEVELS.map((lv) => {
            const here = rows.filter((r) => r.p.level === lv);
            const d = here.filter((r) => r.done).length;
            return (
              <div className="ml-level" key={lv}>
                <div className="ml-level-h"><span className={`lvl ${lv.toLowerCase()}`}>{lv}</span><span>{d}/{here.length} tracks</span></div>
                <div className="bar"><i style={{ width: `${(d / Math.max(1, here.length)) * 100}%` }} /></div>
                <ul className="ml-tracks">
                  {here.map((r) => (
                    <li key={r.p.slug} className={r.done ? "done" : r.started ? "started" : ""}>
                      <Icon name={r.done ? "check" : "circle"} />
                      <Link href={`/tracks/${r.p.slug}`}>{r.t.title}</Link>
                      <small>{r.labTotal > 0 && `lab ${r.labDone}/${r.labTotal}`}{r.qBest !== null && ` · quiz ${r.qBest}/${r.qTotal}`}</small>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <div className="ml-col">
          <section className="card">
            <div className="sub-h" style={{ marginTop: 0 }}>Review</div>
            {review.length ? (
              <ul className="ml-list">
                {review.map((r) => <li key={r.key}><Link href={r.href}>{r.text}</Link><small>{r.note}</small></li>)}
              </ul>
            ) : <p className="ml-empty">Nothing to review yet — start a track and anything unfinished shows up here.</p>}
            <p className="ml-foot"><Link href="/quiz">All quizzes</Link> · <Link href="/glossary">Glossary</Link></p>
          </section>

          <section className="card">
            <div className="sub-h" style={{ marginTop: 0 }}>Command practice</div>
            {tiers.map((t) => (
              <div className="ml-tier" key={t.lv}>
                <span className={`lvl ${t.lv.toLowerCase()}`}>{t.lv}</span>
                <div className="bar"><i style={{ width: `${(t.done / Math.max(1, t.total)) * 100}%` }} /></div>
                <span className="ml-tier-n">{t.done}/{t.total}</span>
              </div>
            ))}
            <p className="ml-foot"><Link href="/commands/practice">{drillsDone ? "Continue practising" : "Start practising"} →</Link></p>
          </section>

          <section className="card">
            <div className="sub-h" style={{ marginTop: 0 }}>Flashcards</div>
            <p className="ml-fc"><b>{fc.due}</b> due · <b>{fc.fresh}</b> new today · <b>{fc.learned}</b>/{cards.length} learned</p>
            <p className="ml-foot"><Link href="/review">{fc.due + fc.fresh ? "Review now (a few minutes)" : "All caught up — browse decks"} →</Link></p>
          </section>
        </div>
      </div>

      <div className="ml-grid">
        <section className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Certifications</div>
          {certs ? (
            <ul className="ml-certs">
              {certs.map((c) => (
                <li key={c.id}>
                  <div className="ml-cert-h"><b>{c.code}</b><span className={`lvl ${c.level.toLowerCase()}`}>{c.level}</span></div>
                  <span className="ml-cert-name">{c.name}</span>
                  {c.earned ? <Link href={`/cert/${c.earned}`}>Certified — view certificate</Link>
                    : c.ready ? <Link href={`/certify/${c.id}`}>Ready — take the exam →</Link>
                    : <span className="ml-cert-next">{c.met}/{c.total} requirements · next: {c.next?.href ? <Link href={c.next.href}>{c.next.label}</Link> : c.next?.label}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="ml-empty"><Link href="/login">Sign in</Link> to see how close you are to each certification.</p>}
        </section>

        <section className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Challenges for you</div>
          {handle ? (
            suggest.length ? (
              <ul className="ml-list">
                {suggest.map((c) => (
                  <li key={c.id}><Link href={`/challenges#${c.id}`}>{c.title}</Link><small>{c.track} · {c.points} pts{c.level ? ` · ${c.level}` : ""}</small></li>
                ))}
              </ul>
            ) : <p className="ml-empty">No open challenges in the tracks you&apos;ve finished — complete another track to unlock suggestions, or browse them all.</p>
          ) : <p className="ml-empty"><Link href="/login">Sign in</Link> to get challenge suggestions and track your score.</p>}
          <p className="ml-foot"><Link href="/challenges">All challenges</Link></p>
        </section>
      </div>
    </>
  );
}
