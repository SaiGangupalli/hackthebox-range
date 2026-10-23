import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { challenges, totalPoints, FLAG_FORMAT } from "@/data/challenges";
import { Icon } from "@/components/icons";
import { SubmitForm } from "@/components/SubmitForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Challenges · H@ck1h3B0x Range" };

export default async function ChallengesPage() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  const handle = session?.user?.name;

  const solved = new Set<string>();
  if (uid) {
    try {
      const rows = await prisma.solve.findMany({ where: { userId: uid }, select: { challengeId: true } });
      rows.forEach((r) => solved.add(r.challengeId));
    } catch { /* DB not reachable yet — show challenges without solved state */ }
  }
  const myPoints = challenges.filter((c) => solved.has(c.id)).reduce((s, c) => s + c.points, 0);
  const groups = [...new Set(challenges.map((c) => c.track))];

  return (
    <>
      <div className="eyebrow"><Icon name="flag" />capture the flag</div>
      <h1 className="view-title">Challenges</h1>
      <p className="lede">
        Solve each task with the in-browser <Link href="/tools">Lab tools</Link>, then submit the flag
        (format <code>{FLAG_FORMAT}</code>). Points land on the <Link href="/scoreboard">scoreboard</Link>.
      </p>

      {uid ? (
        <div className="callout info" style={{ marginBottom: 20 }}>
          <Icon name="trophy" />
          <div>Signed in as <b>{handle}</b> — <b>{myPoints}</b>/{totalPoints} points, {solved.size}/{challenges.length} solved.</div>
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
            {challenges.filter((c) => c.track === g).map((c) => {
              const done = solved.has(c.id);
              return (
                <div className={`chal${done ? " solved" : ""}`} key={c.id}>
                  <div className="chal-top">
                    <h3>{c.title}</h3>
                    <span className="pts">{c.points} pts</span>
                  </div>
                  <pre className="chal-prompt">{c.prompt}</pre>
                  <p className="chal-hint"><b>Hint:</b> {c.hint}</p>
                  {done ? (
                    <div className="chal-solved"><Icon name="check" /> Solved</div>
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
