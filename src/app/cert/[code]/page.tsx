import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { findCertificate, CODE_RE } from "@/lib/certify/exam";
import { Icon } from "@/components/icons";
import { Copyable } from "@/components/Copyable";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

async function load(code: string) {
  if (!CODE_RE.test(code)) return null;
  try { return await findCertificate(code); } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const found = await load((await params).code);
  if (!found) return { title: "Certificate not found · H@ck1h3B0x Range", robots: { index: false } };
  const title = `${found.handle} — ${found.cert.name}`;
  const description = `${found.handle} earned the ${found.cert.name} (${found.cert.level}) on H@ck1h3B0x Range with ${found.record.pct}% on the exam. Verify certificate ${found.record.code}.`;
  return { title, description, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
}

// A Range certificate: printable, and anyone with the link can verify it.
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await load(code);
  if (!found) notFound();
  const { cert, record, handle } = found;
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3003"}/cert/${record.code}`;
  const issued = new Date(record.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="cert-verified no-print">
        <Icon name="check" />
        <div><b>Verified.</b> This certificate was issued by H@ck1h3B0x Range to <Link href={`/u/${handle}`}>{handle}</Link> on {issued}.</div>
      </div>

      <article className={`certificate ${cert.level.toLowerCase()}`}>
        <div className="cf-brand"><span className="cf-logo">H@ck1h3B0x</span> Range · VICS Security Conclave 2026</div>
        <div className="cf-seal"><Icon name="cert" /></div>
        <p className="cf-small">This certifies that</p>
        <h1 className="cf-name">{handle}</h1>
        <p className="cf-small">has earned</p>
        <h2 className="cf-title">{cert.name}</h2>
        <p className="cf-level"><span className={`lvl ${cert.level.toLowerCase()}`}>{cert.level}</span> {cert.code}</p>
        <p className="cf-desc">{cert.blurb}</p>
        <div className="cf-facts">
          <div><span>Exam score</span><b>{record.pct}%</b><small>{record.score} of {record.total} correct · pass mark {cert.exam.pass}%</small></div>
          <div><span>Issued</span><b>{issued}</b></div>
          <div><span>Certificate code</span><b className="mono">{record.code}</b></div>
        </div>
        <p className="cf-verify">Verify at {url}</p>
        <p className="cf-fine">A practice credential issued by the H@ck1h3B0x Range training platform. It records completed tracks, labs and a passed exam on this site; it is not an industry certification.</p>
      </article>

      <div className="sheet-actions no-print cert-actions">
        <PrintButton className="btn primary" />
        <Copyable text={url} />
        <Link className="btn" href="/certifications">All certifications</Link>
      </div>
    </>
  );
}
