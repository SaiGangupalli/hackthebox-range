import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges, totalPoints, FLAG_FORMAT } from "@/data/challenges";
import { tracks } from "@/data/tracks";
import { pathOrder } from "@/data/path";
import { score } from "@/lib/stats";
import { eventInfo, acceptsFlags } from "@/lib/event";
import { Icon } from "@/components/icons";
import { SubmitForm } from "@/components/SubmitForm";
import { HintButton, VoteControl } from "@/components/ChallengeExtras";
import { EventBanner } from "@/components/EventBanner";
import { siteOrDefault } from "@/lib/settings";
import { isAdminHandle } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Challenges · H@ck1h3B0x Range" };

// Which track teaches the skill each challenge needs (challenges are grouped by
// track title), and a rough difficulty.
const LEARN_FIRST: Record<string, [string, string]> = Object.fromEntries(
  Object.values(tracks).map((t) => [t.title, [t.slug, t.title]]),
);
const groupRank = (g: string) => (g === "Warm-up" ? -1 : pathOrder.indexOf(LEARN_FIRST[g]?.[0] ?? ""));
const difficulty = (pts: number) => (pts <= 15 ? "easy" : pts <= 20 ? "medium" : "harder");

type Stat = { solves: number; first: string | null; votes: number; avg: number | null };

export default async function ChallengesPage() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  const handle = session?.user?.name;
  const ev = eventInfo();
  const open = acceptsFlags(ev);
  const site = await siteOrDefault();
  const admin = isAdminHandle(handle);
  // Organizers can hide a broken challenge; they still see it, labelled.
  const visible = challenges.filter((c) => admin || !site.hidden.includes(c.id));
  const banned = new Set(site.banned);

  const stats: Record<string, Stat> = Object.fromEntries(challenges.map((c) => [c.id, { solves: 0, first: null, votes: 0, avg: null }]));
  const solved = new Set<string>();
  const unlocked = new Map<string, number>(); // `${challengeId}:${hint}` → cost paid
  const myVote = new Map<string, number>();
  let my = { points: 0, hintCost: 0 };
  let dbOk = true;

  try {
    const [allSolves, votes, myHints] = await Promise.all([
      prisma.solve.findMany({ select: { challengeId: true, userId: true, points: true, createdAt: true, user: { select: { handle: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.vote.groupBy({ by: ["challengeId"], _avg: { rating: true }, _count: { _all: true } }),
      uid ? prisma.hintUnlock.findMany({ where: { userId: uid }, select: { userId: true, challengeId: true, hint: true, cost: true, createdAt: true } }) : Promise.resolve([]),
    ]);
    for (const s of allSolves) {
      if (banned.has(s.userId)) continue;
      const st = stats[s.challengeId];
      if (!st) continue;
      st.solves++;
      if (!st.first) st.first = s.user.handle;
      if (s.userId === uid) solved.add(s.challengeId);
    }
    for (const v of votes) if (stats[v.challengeId]) { stats[v.challengeId].votes = v._count._all; stats[v.challengeId].avg = v._avg.rating; }
    for (const h of myHints) unlocked.set(`${h.challengeId}:${h.hint}`, h.cost);
    if (uid) {
      const mine = await prisma.vote.findMany({ where: { userId: uid }, select: { challengeId: true, rating: true } });
      mine.forEach((v) => myVote.set(v.challengeId, v.rating));
      const sc = score(allSolves.filter((s) => s.userId === uid), myHints);
      my = { points: sc.points, hintCost: sc.hintCost };
    }
  } catch {
    dbOk = false; // DB not reachable yet — show challenges without live stats
  }

  // Warm-up first, then tracks in learning-path order.
  const groups = [...new Set(visible.map((c) => c.track))].sort((a, b) => groupRank(a) - groupRank(b));

  return (
    <>
      <div className="eyebrow"><Icon name="flag" />capture the flag</div>
      <h1 className="view-title">Challenges</h1>
      <p className="lede">
        Solve each task with the in-browser <Link href="/tools">Lab tools</Link>, then submit the flag
        (format <code>{FLAG_FORMAT}</code>). Points land on the <Link href="/scoreboard">scoreboard</Link>.
      </p>

      <EventBanner event={ev} />

      <ol className="howto chal-how" aria-label="How challenges work">
        <li><span>1</span><div>Pick a challenge — the warm-up and the 15–20 point ones are the easiest.</div></li>
        <li><span>2</span><div>Work it out with the in-browser <Link href="/tools">Lab tools</Link>. Each card has a free hint; extra hints cost points.</div></li>
        <li><span>3</span><div>Paste the flag (it looks like {FLAG_FORMAT}) into the box and press Submit. Solving unlocks the writeup.</div></li>
      </ol>

      {uid ? (
        <div className="callout info" style={{ marginBottom: 20 }}>
          <Icon name="trophy" />
          <div style={{ flex: 1 }}>
            Signed in as <Link href={`/u/${handle}`}><b>{handle}</b></Link> — <b>{my.points}</b>/{totalPoints} points
            {my.hintCost > 0 && <> (−{my.hintCost} for hints)</>}, {solved.size}/{challenges.length} solved.
            <div className="bar chal-bar"><i style={{ width: `${(solved.size / challenges.length) * 100}%` }} /></div>
          </div>
        </div>
      ) : (
        <div className="callout warn" style={{ marginBottom: 20 }}>
          <Icon name="shield" />
          <div><b>Playing as a guest.</b> <Link href="/login">Sign in</Link> or <Link href="/register">create a handle</Link> to submit flags and score. You can still read every challenge below.</div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g}>
          <div className="sec-h"><Icon name="zap" />{g}</div>
          <div className="chal-grid">
            {visible.filter((c) => c.track === g).map((c) => {
              const done = solved.has(c.id);
              const st = stats[c.id];
              return (
                <div className={`chal${done ? " solved" : ""}`} key={c.id}>
                  {site.hidden.includes(c.id) && <div className="chal-hidden"><Icon name="shield" />Hidden from players — only organizers can see this</div>}
                  <div className="chal-top">
                    <h3>{c.title}</h3>
                    <span className="chal-badges">
                      {c.level
                        ? <span className={`lvl ${c.level.toLowerCase()}`}>{c.level}</span>
                        : <span className={`diff ${difficulty(c.points)}`}>{difficulty(c.points)}</span>}
                      <span className="pts">{c.points} pts</span>
                    </span>
                  </div>

                  {dbOk && (
                    <div className="chal-meta">
                      <span><Icon name="flag" />{st.solves} solve{st.solves === 1 ? "" : "s"}</span>
                      {st.first ? (
                        <span className="fb"><Icon name="trophy" />first blood: <Link href={`/u/${st.first}`}>{st.first}</Link></span>
                      ) : (
                        <span className="fb open"><Icon name="trophy" />first blood is up for grabs</span>
                      )}
                      {st.avg !== null && <span>rated {st.avg.toFixed(1)}/5 by {st.votes}</span>}
                    </div>
                  )}

                  <pre className="chal-prompt">{c.prompt}</pre>
                  <p className="chal-hint"><b>Hint:</b> {c.hint}</p>

                  {(c.hints ?? []).map((h, i) => {
                    const paid = unlocked.get(`${c.id}:${i}`);
                    if (paid !== undefined) {
                      return <p className="chal-hint paid" key={i}><b>Extra hint {i + 1}:</b> {h.text} <span>{paid ? `(−${paid} pts)` : "(free)"}</span></p>;
                    }
                    return uid ? (
                      <HintButton key={i} challengeId={c.id} index={i} cost={h.cost} free={done} />
                    ) : (
                      <p className="chal-hint locked" key={i}><Icon name="crypto" /> Extra hint {i + 1} ({h.cost} pts) — sign in to open it.</p>
                    );
                  })}

                  {LEARN_FIRST[c.track] && (
                    <Link className="chal-learn" href={`/tracks/${LEARN_FIRST[c.track][0]}`}>
                      <Icon name="book" />Stuck? Learn this in the {LEARN_FIRST[c.track][1]} track
                    </Link>
                  )}

                  {done ? (
                    <>
                      <div className="chal-solved"><Icon name="check" /> Solved</div>
                      {c.writeup && (
                        <details className="writeup">
                          <summary>Read the writeup</summary>
                          <p>{c.writeup}</p>
                        </details>
                      )}
                      <VoteControl challengeId={c.id} current={myVote.get(c.id) ?? null} />
                    </>
                  ) : !open ? (
                    <div className="chal-closed"><Icon name="shield" />{ev.state === "before" ? "Opens when the event starts." : "Submissions are closed — the event has ended."}</div>
                  ) : uid ? (
                    <SubmitForm challengeId={c.id} />
                  ) : (
                    <Link className="btn" href="/login"><Icon name="shield" />Sign in to submit</Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
