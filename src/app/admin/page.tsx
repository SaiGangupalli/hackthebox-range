import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";
import { currentAdmin, isAdminHandle } from "@/lib/admin";
import { getSite, getAudit } from "@/lib/settings";
import { eventInfo } from "@/lib/event";
import { Icon } from "@/components/icons";
import { AdminPanel, type AdminData } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizer · H@ck1h3B0x Range", robots: { index: false } };

const PAIR_WINDOW_S = 120; // two players solving the same challenge this close together

// Organizer console: announcements, challenge visibility, players (ban,
// password reset), a flag-sharing check and the audit log. Anyone who isn't in
// ADMIN_HANDLES gets a plain 404.
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) notFound();

  let data: AdminData | null = null;
  let dbError = false;
  try {
    const [site, log, users, solves] = await Promise.all([
      getSite(),
      getAudit(),
      prisma.user.findMany({
        select: { id: true, handle: true, createdAt: true, solves: { select: { points: true } }, hints: { select: { cost: true } }, membership: { select: { team: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.solve.findMany({ select: { userId: true, challengeId: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    ]);
    const handleOf = new Map(users.map((u) => [u.id, u.handle]));
    const teamOf = new Map(users.map((u) => [u.id, u.membership?.team.name ?? null]));

    // Possible flag sharing: pairs of players who solved the same challenges
    // within seconds of each other, more than once.
    const pairs = new Map<string, { a: string; b: string; challenges: string[] }>();
    const byChallenge = new Map<string, typeof solves>();
    for (const s of solves) byChallenge.set(s.challengeId, [...(byChallenge.get(s.challengeId) ?? []), s]);
    for (const [cid, list] of byChallenge) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length && (list[j].createdAt.getTime() - list[i].createdAt.getTime()) / 1000 <= PAIR_WINDOW_S; j++) {
          const [a, b] = [list[i].userId, list[j].userId].sort();
          const key = `${a}|${b}`;
          const row = pairs.get(key) ?? { a, b, challenges: [] };
          row.challenges.push(cid);
          pairs.set(key, row);
        }
      }
    }
    const suspicious = [...pairs.values()]
      .filter((p) => p.challenges.length >= 2)
      .map((p) => ({ a: handleOf.get(p.a) ?? "?", b: handleOf.get(p.b) ?? "?", count: p.challenges.length, sameTeam: !!teamOf.get(p.a) && teamOf.get(p.a) === teamOf.get(p.b), challenges: p.challenges }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 30);

    const solveCount = new Map<string, number>();
    for (const s of solves) solveCount.set(s.challengeId, (solveCount.get(s.challengeId) ?? 0) + 1);
    const banned = new Set(site.banned);

    data = {
      me: admin.handle,
      announcement: site.announcement,
      challenges: challenges.map((c) => ({ id: c.id, title: c.title, track: c.track, points: c.points, solves: solveCount.get(c.id) ?? 0, hidden: site.hidden.includes(c.id) })),
      players: users.map((u) => ({
        handle: u.handle,
        joined: u.createdAt.toISOString(),
        solved: u.solves.length,
        points: u.solves.reduce((s, x) => s + x.points, 0) - u.hints.reduce((s, h) => s + h.cost, 0),
        team: u.membership?.team.name ?? null,
        banned: banned.has(u.id),
        admin: isAdminHandle(u.handle),
      })),
      suspicious,
      audit: log.slice(0, 60),
      event: eventInfo(),
      windowSeconds: PAIR_WINDOW_S,
    };
  } catch {
    dbError = true;
  }

  return (
    <>
      <div className="eyebrow"><Icon name="wrench" />organizer</div>
      <h1 className="view-title">Organizer console</h1>
      <p className="lede">Signed in as <b>{admin.handle}</b>. Changes take effect for players within a few seconds and are recorded in the audit log below.</p>
      {dbError || !data ? (
        <div className="callout warn"><Icon name="shield" /><div>The database isn&apos;t reachable right now. Try again shortly.</div></div>
      ) : (
        <AdminPanel data={data} />
      )}
    </>
  );
}
