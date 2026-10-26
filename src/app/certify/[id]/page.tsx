import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { rangeCertById, studyId } from "@/data/certify";
import { certStatus, guestRequirements, RETRY_MINUTES, type CertStatus } from "@/lib/certify/exam";
import { studyLink, type StudyLink } from "@/lib/certify/study";
import { Icon } from "@/components/icons";
import { InlineCode } from "@/components/InlineCode";
import { ExamRunner } from "@/components/ExamRunner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const c = rangeCertById[(await params).id];
  return { title: c ? `${c.code} exam · H@ck1h3B0x Range` : "H@ck1h3B0x Range" };
}

export default async function CertifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = rangeCertById[id];
  if (!cert) notFound();
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  let status: CertStatus | null = null;
  let dbError = false;
  if (uid) {
    try { status = (await certStatus(uid))[id]; } catch { dbError = true; }
  }

  return (
    <>
      <div className="eyebrow"><Link href="/certifications"><Icon name="cert" />certifications</Link> · {cert.code} · {cert.level}</div>
      <h1 className="view-title">{cert.name}</h1>
      <p className="lede">{cert.blurb}</p>
      {dbError && <div className="callout warn" style={{ marginBottom: 16 }}><Icon name="shield" /><div>The database isn&apos;t reachable right now, so your progress can&apos;t be checked. Please try again shortly.</div></div>}
      <ExamRunner cert={cert} status={status} reqs={status?.reqs ?? guestRequirements(cert)} signedIn={!!uid} retryMinutes={RETRY_MINUTES} />

      <section className="study" id="study" aria-labelledby="study-h">
        <h2 id="study-h"><Icon name="book" />Study guide</h2>
        <p className="study-intro">
          Everything the exam asks about, and where this site teaches it. Questions are drawn from every topic below, so
          work through the lessons and labs for each one — the exam result links your weakest topics back here.
        </p>
        <ol className="study-list">
          {cert.study.map((t) => (
            <li key={t.topic} id={studyId(t.topic)}>
              <h3>{t.topic}</h3>
              <ul className="study-links">
                {t.refs.map(studyLink).filter((l): l is StudyLink => l !== null).map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>
                      <span className={`study-kind k-${l.kind.toLowerCase()}`}>{l.kind}</span>
                      <span className="study-label"><InlineCode text={l.label} />{l.where && <small>{l.where}</small>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
