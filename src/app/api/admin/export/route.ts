import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";
import { rangeCertById } from "@/data/certify";
import { currentAdmin } from "@/lib/admin";
import { getBoard, firstSolvers } from "@/lib/stats";
import { siteOrDefault, audit } from "@/lib/settings";
import { toCsv } from "@/lib/csv";
import { SITE_URL } from "@/lib/site";
import type { CertRecord } from "@/lib/certify/exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));
const KINDS = ["players", "teams", "solves", "certificates"] as const;
type Kind = (typeof KINDS)[number];

// Organizer downloads for prizes and records. Always the full picture: a
// scoreboard freeze doesn't apply here. Standings leave out banned players,
// like the public board; the solve log keeps them, marked.
async function build(kind: Kind): Promise<{ header: string[]; rows: unknown[][] }> {
  if (kind === "players" || kind === "teams") {
    const board = await getBoard(null, true);
    if (kind === "players") {
      return {
        header: ["rank", "handle", "team", "points", "solved", "hint_penalty", "reached_score_at"],
        rows: board.players.map((p, i) => [i + 1, p.handle, p.team ?? "", p.points, p.solved, p.hintCost, p.last]),
      };
    }
    return {
      header: ["rank", "team", "members", "points", "solved", "hint_penalty", "reached_score_at"],
      rows: board.teams.map((t, i) => [i + 1, t.name, t.members.join("; "), t.points, t.solved, t.hintCost, t.last]),
    };
  }

  if (kind === "solves") {
    const [solves, first, { banned }] = await Promise.all([
      prisma.solve.findMany({
        select: { challengeId: true, points: true, createdAt: true, userId: true, user: { select: { handle: true, membership: { select: { team: { select: { name: true } } } } } } },
        orderBy: { createdAt: "asc" },
      }),
      firstSolvers(null, true),
      siteOrDefault(),
    ]);
    return {
      header: ["solved_at", "handle", "team", "challenge_id", "challenge", "track", "points", "first_blood", "banned"],
      rows: solves
        .filter((s) => challengeById[s.challengeId])
        .map((s) => [
          s.createdAt, s.user.handle, s.user.membership?.team.name ?? "", s.challengeId, challengeById[s.challengeId].title, challengeById[s.challengeId].track, s.points,
          first.get(s.challengeId) === s.user.handle ? "yes" : "", banned.includes(s.userId) ? "yes" : "",
        ]),
    };
  }

  const certs = await prisma.progress.findMany({ where: { kind: "cert" }, select: { key: true, data: true, user: { select: { handle: true } } } });
  return {
    header: ["issued_at", "handle", "certificate", "level", "code", "score", "out_of", "percent", "verify_url"],
    rows: certs
      .filter((c) => rangeCertById[c.key])
      .map((c) => ({ c, r: c.data as CertRecord }))
      .sort((a, b) => a.r.issuedAt.localeCompare(b.r.issuedAt))
      .map(({ c, r }) => [r.issuedAt, c.user.handle, rangeCertById[c.key].name, rangeCertById[c.key].level, r.code, r.score, r.total, r.pct, `${SITE_URL}/cert/${r.code}`]),
  };
}

export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Not found", { status: 404 });
  const kind = new URL(req.url).searchParams.get("what") as Kind;
  if (!KINDS.includes(kind)) return new Response(`Choose what=${KINDS.join("|")}`, { status: 400 });

  try {
    const { header, rows } = await build(kind);
    await audit(admin.handle, "exported", `${kind} (${rows.length} rows)`);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    return new Response(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hhb-${kind}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Database unavailable — try again shortly.", { status: 503 });
  }
}
