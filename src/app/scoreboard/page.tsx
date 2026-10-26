import Link from "next/link";
import { auth } from "@/auth";
import { totalPoints } from "@/data/challenges";
import { getBoard } from "@/lib/stats";
import { boardCutoff } from "@/lib/event";
import { getEvent } from "@/lib/settings";
import { Icon } from "@/components/icons";
import { EventBanner } from "@/components/EventBanner";
import { ActivityFeed } from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scoreboard · H@ck1h3B0x Range" };

// Players and teams, ranked by points (solves minus paid hints); ties go to
// whoever reached their score first. During a freeze the board shows the
// standings as they were at the freeze moment.
export default async function ScoreboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "teams" ? "teams" : "players";
  const me = (await auth())?.user?.name ?? null;
  const ev = await getEvent();
  const cutoff = boardCutoff(ev);

  let board: Awaited<ReturnType<typeof getBoard>> | null = null;
  try {
    board = await getBoard(cutoff);
  } catch {
    board = null;
  }
  const myTeam = board?.players.find((p) => p.handle === me)?.team ?? null;

  return (
    <>
      <div className="eyebrow"><Icon name="trophy" />standings</div>
      <h1 className="view-title">Scoreboard</h1>
      <p className="lede">
        Live ranking across all <Link href="/challenges">challenges</Link> — {totalPoints} points on the board. Updates every few seconds.
        Paid hints come off your points. On a tie, whoever reached their score first ranks higher.
      </p>

      <EventBanner event={ev} />

      <div className="tabs" role="tablist">
        <Link role="tab" aria-selected={view === "players"} className={`tab${view === "players" ? " on" : ""}`} href="/scoreboard">Players</Link>
        <Link role="tab" aria-selected={view === "teams"} className={`tab${view === "teams" ? " on" : ""}`} href="/scoreboard?view=teams">Teams</Link>
        <Link className="tab-side" href="/teams"><Icon name="flag" />{me ? "Your team" : "About teams"}</Link>
      </div>

      {!board ? (
        <div className="callout warn">
          <Icon name="shield" />
          <div>The scoreboard turns on once <code>DATABASE_URL</code> is set in <code>.env.local</code> and the migration is applied. See the README.</div>
        </div>
      ) : view === "players" ? (
        board.players.length === 0 ? (
          <div className="callout info"><Icon name="flag" /><div>No solves yet — <Link href="/challenges">be the first on the board</Link>.</div></div>
        ) : (
          <div className="board board-players">
            <div className="board-head"><span>#</span><span>player</span><span>team</span><span>solved</span><span>points</span></div>
            {board.players.map((r, i) => (
              <div className={`board-row${i < 3 ? " podium" : ""}${r.handle === me ? " me" : ""}`} key={r.handle}>
                <span className="rank">{i + 1}</span>
                <span className="who">
                  <Link href={`/u/${r.handle}`}>{r.handle}</Link>
                  <span className={`rank-chip r${r.rank.level}`}>{r.rank.name}</span>
                  {r.handle === me && <span className="me-tag">you</span>}
                </span>
                <span className="tm">{r.team ?? "—"}</span>
                <span className="sv">{r.solved}</span>
                <span className="pt">{r.points}</span>
              </div>
            ))}
          </div>
        )
      ) : board.teams.length === 0 ? (
        <div className="callout info"><Icon name="flag" /><div>No teams yet. <Link href="/teams">Create one and invite your friends</Link>.</div></div>
      ) : (
        <div className="board board-teams">
          <div className="board-head"><span>#</span><span>team</span><span>members</span><span>solved</span><span>points</span></div>
          {board.teams.map((t, i) => (
            <div className={`board-row${i < 3 ? " podium" : ""}${t.name === myTeam ? " me" : ""}`} key={t.name}>
              <span className="rank">{i + 1}</span>
              <span className="who">{t.name}{t.name === myTeam && <span className="me-tag">your team</span>}</span>
              <span className="tm">{t.members.map((m, k) => <span key={m}>{k > 0 && ", "}<Link href={`/u/${m}`}>{m}</Link></span>)}</span>
              <span className="sv">{t.solved}</span>
              <span className="pt">{t.points}</span>
            </div>
          ))}
        </div>
      )}

      <div className="sec-h"><Icon name="zap" />Recent activity</div>
      <ActivityFeed />
    </>
  );
}
