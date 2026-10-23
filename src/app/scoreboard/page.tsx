import Link from "next/link";
import { prisma } from "@/lib/db";
import { totalPoints } from "@/data/challenges";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scoreboard · H@ck1h3B0x Range" };

type Row = { handle: string; points: number; solves: number; last: Date | null };

export default async function ScoreboardPage() {
  let rows: Row[] = [];
  let dbError = false;
  try {
    const grouped = await prisma.solve.groupBy({
      by: ["userId"],
      _sum: { points: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, handle: true },
    });
    const byId = new Map(users.map((u) => [u.id, u.handle]));
    rows = grouped.map((g) => ({
      handle: byId.get(g.userId) ?? "—",
      points: g._sum.points ?? 0,
      solves: g._count._all,
      last: g._max.createdAt,
    }));
    // Highest points first; ties broken by whoever reached their total earliest.
    rows.sort((a, b) => b.points - a.points || (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0));
  } catch {
    dbError = true;
  }

  return (
    <>
      <div className="eyebrow"><Icon name="trophy" />standings</div>
      <h1 className="view-title">Scoreboard</h1>
      <p className="lede">
        Live ranking across all <Link href="/challenges">challenges</Link> — {totalPoints} points on the board.
      </p>

      {dbError ? (
        <div className="callout warn">
          <Icon name="shield" />
          <div>The scoreboard turns on once <code>DATABASE_URL</code> is set in <code>.env.local</code> and the migration is applied. See the README.</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="callout info">
          <Icon name="flag" />
          <div>No solves yet — <Link href="/challenges">be the first on the board</Link>.</div>
        </div>
      ) : (
        <div className="board">
          <div className="board-head"><span>#</span><span>handle</span><span>solved</span><span>points</span></div>
          {rows.map((r, i) => (
            <div className={`board-row${i < 3 ? " top" : ""}`} key={r.handle + i}>
              <span className="rank">{i + 1}</span>
              <span className="who">{r.handle}</span>
              <span className="sv">{r.solves}</span>
              <span className="pt">{r.points}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
