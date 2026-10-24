import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProfile, MAX } from "@/lib/stats";
import { tracks } from "@/data/tracks";
import { path } from "@/data/path";
import { quiz } from "@/data/quiz";
import { labById } from "@/data/labs";
import { Icon } from "@/components/icons";
import { eventInfo, boardCutoff } from "@/lib/event";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `${decodeURIComponent(handle)} · H@ck1h3B0x Range` };
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// A player's public profile: rank and XP, CTF score, learning progress per
// track, and solved challenges.
export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const target = decodeURIComponent(handle).toLowerCase();
  const viewer = (await auth())?.user?.name ?? null;
  // During a scoreboard freeze, other people's profiles hide post-freeze solves.
  const cutoff = viewer === target ? null : boardCutoff(eventInfo());
  let p: Awaited<ReturnType<typeof getProfile>>;
  try {
    p = await getProfile(target, cutoff);
  } catch {
    return (
      <div className="callout warn"><Icon name="shield" /><div>Profiles need the database. See the README to connect it.</div></div>
    );
  }
  if (!p) notFound();
  const me = viewer === p.handle;
  const earned = p.badges.filter((b) => b.earned).length;
  const r = p.rank;

  return (
    <>
      <div className="eyebrow"><Icon name="trophy" />player profile</div>
      <div className="prof-head">
        <span className="prof-avatar" aria-hidden="true">{p.handle.slice(0, 2).toUpperCase()}</span>
        <div className="prof-id">
          <h1 className="view-title">{p.handle}</h1>
          <div className="prof-meta">
            <span className={`rank-chip r${r.level}`}>{r.name}</span>
            {p.team && <span><Icon name="flag" />team <Link href="/scoreboard?view=teams">{p.team}</Link></span>}
            {p.firstBloods.length > 0 && <span className="fb-count"><Icon name="trophy" />{p.firstBloods.length} first blood{p.firstBloods.length === 1 ? "" : "s"}</span>}
            <span>joined {fmtDate(p.joined)}</span>
          </div>
        </div>
      </div>

      <div className="xp-card">
        <div className="xp-top">
          <b>{r.xp} XP</b>
          <span>{r.next ? `${r.next.xp - r.xp} XP to ${r.next.name}` : "Top rank reached — everything complete"}</span>
        </div>
        <div className="bar xp-bar"><i style={{ width: `${r.pct}%` }} /></div>
        <p className="xp-how">XP comes from lab objectives (10 each), quiz answers (5 each), finished tracks (25 each) and challenge points.</p>
      </div>

      <div className="stat-grid">
        <div className="stat"><b>{p.score.points}</b><span>CTF points</span><small>{p.score.solved} challenge{p.score.solved === 1 ? "" : "s"} solved{p.score.hintCost ? ` · −${p.score.hintCost} for hints` : ""}</small></div>
        <div className="stat"><b>{p.learn.objectives}<i>/{MAX.objectives}</i></b><span>lab objectives</span><small>across {Object.keys(p.learn.labs).length} labs</small></div>
        <div className="stat"><b>{p.learn.quizCorrect}<i>/{MAX.quizCorrect}</i></b><span>quiz answers</span><small>best scores</small></div>
        <div className="stat"><b>{p.learn.tracks.size}<i>/{MAX.tracks}</i></b><span>tracks complete</span><small>learning path</small></div>
      </div>

      {me && (
        <div className="callout info" style={{ marginBottom: 6 }}>
          <Icon name="book" />
          <div>This is you. Progress you make while signed in is saved to your account, so it follows you to any device.</div>
        </div>
      )}

      <div className="sec-h"><Icon name="trophy" />Badges · {earned}/{p.badges.length}</div>
      <div className="badges">
        {p.badges.map((b) => (
          <div className={`badge${b.earned ? " earned" : ""}`} key={b.id} title={b.earned ? "Earned" : "Not earned yet"}>
            <span className="badge-ic"><Icon name={b.icon} /></span>
            <b>{b.name}</b>
            <small>{b.desc}</small>
          </div>
        ))}
      </div>

      <div className="sec-h"><Icon name="flag" />Learning path</div>
      <div className="prof-table-wrap">
        <table className="prof-table">
          <thead><tr><th>#</th><th>Track</th><th>Lab</th><th>Quiz</th><th>Status</th></tr></thead>
          <tbody>
            {path.map((step, i) => {
              const lab = labById[step.labId];
              const labDone = p.learn.labs[step.labId] ?? 0;
              const qBest = p.learn.quizzes[step.slug];
              const done = p.learn.tracks.has(step.slug);
              return (
                <tr key={step.slug} className={done ? "done" : ""}>
                  <td>{i + 1}</td>
                  <td><Link href={`/tracks/${step.slug}`}>{tracks[step.slug].title}</Link></td>
                  <td><span className="mini-bar"><i style={{ width: `${lab ? (labDone / lab.objectives) * 100 : 0}%` }} /></span>{labDone}/{lab?.objectives ?? 0}</td>
                  <td>{qBest === undefined ? "—" : `${qBest}/${quiz[step.slug].length}`}</td>
                  <td>{done ? <span className="ok-tag"><Icon name="check" />complete</span> : labDone || qBest !== undefined ? "in progress" : "not started"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sec-h"><Icon name="trophy" />Solved challenges</div>
      {p.solves.length === 0 ? (
        <p className="prof-empty">No flags yet. <Link href="/challenges">Try the challenges →</Link></p>
      ) : (
        <ul className="prof-solves">
          {p.solves.map((s) => (
            <li key={s.challengeId}>
              <span className="ps-title">{s.title}{p.firstBloods.includes(s.challengeId) && <span className="feed-fb">first blood</span>}</span>
              <span className="ps-track">{s.track}</span>
              <span className="ps-pts">+{s.points}</span>
              <span className="ps-date">{fmtDate(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
