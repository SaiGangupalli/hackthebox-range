import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges } from "@/data/challenges";
import { rangeCerts } from "@/data/certify";
import { certStatus } from "@/lib/certify/exam";
import { siteOrDefault } from "@/lib/settings";
import { MyLearning, type CertSummary, type ChallengeSummary } from "@/components/MyLearning";

export const dynamic = "force-dynamic";
export const metadata = { title: "My learning · H@ck1h3B0x Range" };

// Personal dashboard. Learning progress lives in the browser (and syncs to the
// account); the server adds what only it knows: solved challenges and
// certification readiness. Challenge data is reduced to safe fields here.
export default async function LearningPage() {
  const user = (await auth())?.user as { id?: string; name?: string | null } | undefined;
  const { hidden } = await siteOrDefault();
  const chal: ChallengeSummary[] = challenges
    .filter((c) => !hidden.includes(c.id))
    .map((c) => ({ id: c.id, title: c.title, track: c.track, points: c.points, level: c.level ?? null }));

  let solved: string[] = [];
  let certs: CertSummary[] | null = null;
  let dbError = false;
  if (user?.id) {
    try {
      const [status, rows] = await Promise.all([certStatus(user.id), prisma.solve.findMany({ where: { userId: user.id }, select: { challengeId: true } })]);
      solved = rows.map((r) => r.challengeId);
      certs = rangeCerts.map((c) => {
        const st = status[c.id];
        return { id: c.id, code: c.code, name: c.name, level: c.level, earned: st.earned?.code ?? null, ready: st.ready, met: st.reqs.filter((r) => r.met).length, total: st.reqs.length, next: st.reqs.find((r) => !r.met) ?? null };
      });
    } catch {
      dbError = true;
    }
  }

  return <MyLearning handle={user?.name ?? null} challenges={chal} solved={solved} certs={certs} dbError={dbError} />;
}
