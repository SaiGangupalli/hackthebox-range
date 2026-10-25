import Link from "next/link";
import { auth } from "@/auth";
import { rangeCerts, rangeCertById } from "@/data/certify";
import { industryCerts, industryCertById, roadmaps, CERTS_REVIEWED, type RoadStep } from "@/data/industryCerts";
import { tracks } from "@/data/tracks";
import { certStatus, guestRequirements, RETRY_MINUTES, type CertStatus } from "@/lib/certify/exam";
import { Icon } from "@/components/icons";
import { CertCatalog } from "@/components/CertCatalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certifications · H@ck1h3B0x Range" };

function stepLabel(s: RoadStep): { href: string; text: string; kind: string } {
  if (s.kind === "track") return { href: `/tracks/${s.id}`, text: tracks[s.id].title, kind: "track" };
  if (s.kind === "range") return { href: `/certify/${s.id}`, text: rangeCertById[s.id].code, kind: "range" };
  return { href: `#cert-${s.id}`, text: industryCertById[s.id].name, kind: "cert" };
}

// Two ways to prove what you've learned: the Range's own certificates (earned
// here) and a guide to real-world certifications mapped to these tracks.
export default async function CertificationsPage() {
  const uid = ((await auth())?.user as { id?: string } | undefined)?.id;
  let status: Record<string, CertStatus> | null = null;
  if (uid) {
    try { status = await certStatus(uid); } catch { status = null; }
  }
  const trackTitles = Object.fromEntries(Object.values(tracks).map((t) => [t.slug, t.title]));

  return (
    <>
      <div className="eyebrow"><Icon name="cert" />certifications</div>
      <h1 className="view-title">Get certified</h1>
      <p className="lede">
        Two ways to prove what you&apos;ve learned: earn a <b>Range certificate</b> here by finishing tracks and passing a
        timed exam, and use the <b>industry guide</b> to prepare for real-world certifications in security, DevOps,
        DevSecOps and AI security — with the tracks on this site that build toward each one.
      </p>
      <nav className="cert-jump">
        <a className="chip-btn" href="#range"><Icon name="cert" />Range certificates</a>
        <a className="chip-btn" href="#industry"><Icon name="resources" />Industry certifications</a>
        <a className="chip-btn" href="#roadmaps"><Icon name="flag" />Career roadmaps</a>
      </nav>

      <section id="range" className="cert-section">
        <h2 className="sec-h"><Icon name="cert" />Earn a Range certificate</h2>
        <ol className="howto">
          <li><span>1</span><div><b>Meet the requirements.</b> Finish the listed tracks (mark them complete) and their labs. Your progress syncs when you&apos;re signed in.</div></li>
          <li><span>2</span><div><b>Pass the timed exam.</b> Questions are drawn at random and graded on the server; you need {rangeCerts[0].exam.pass}%. Not this time? Review and retry after {RETRY_MINUTES} minutes.</div></li>
          <li><span>3</span><div><b>Share it.</b> Your certificate gets a code and a page anyone can verify, and it shows on your profile.</div></li>
        </ol>
        {!uid && (
          <div className="callout warn" style={{ marginBottom: 16 }}>
            <Icon name="shield" />
            <div><Link href="/login">Sign in</Link> or <Link href="/register">create a handle</Link> to track your requirements and take the exams.</div>
          </div>
        )}
        <div className="rc-grid">
          {rangeCerts.map((c) => {
            const st = status?.[c.id] ?? null;
            const reqs = st?.reqs ?? guestRequirements(c);
            return (
              <article className={`rc-card ${c.level.toLowerCase()}`} key={c.id}>
                <div className="rc-top">
                  <span className="rc-icon"><Icon name={c.icon} /></span>
                  <div>
                    <span className={`lvl ${c.level.toLowerCase()}`}>{c.level}</span>
                    <h3>{c.name}</h3>
                    <code className="rc-code">{c.code}</code>
                  </div>
                </div>
                <p className="rc-blurb">{c.blurb}</p>
                <div className="rc-exam">
                  <span><Icon name="book" />{c.exam.questions} questions</span>
                  <span><Icon name="circle" />{c.exam.minutes} min</span>
                  <span><Icon name="trophy" />pass {c.exam.pass}%</span>
                </div>
                <details className="rc-covers"><summary>What the exam covers</summary><div className="chips">{c.covers.map((x) => <span className="chip" key={x}>{x}</span>)}</div></details>
                <ul className="rc-reqs">
                  {reqs.map((r) => (
                    <li key={r.label} className={st && r.met ? "met" : ""}>
                      <Icon name={st && r.met ? "check" : "circle"} />
                      {r.href ? <Link href={r.href}>{r.label}</Link> : r.label}
                    </li>
                  ))}
                </ul>
                <div className="rc-cta">
                  {st?.earned ? (
                    <Link className="btn primary" href={`/cert/${st.earned.code}`}><Icon name="cert" />View your certificate</Link>
                  ) : st?.inProgress ? (
                    <Link className="btn primary" href={`/certify/${c.id}`}><Icon name="zap" />Resume the exam</Link>
                  ) : st?.ready ? (
                    <Link className="btn primary" href={`/certify/${c.id}`}><Icon name="zap" />Take the exam</Link>
                  ) : (
                    <Link className="btn" href={`/certify/${c.id}`}>{st ? "See what's left" : "Requirements & exam"}</Link>
                  )}
                  {st?.best != null && !st.earned && <span className="rc-best">best so far {st.best}%</span>}
                </div>
              </article>
            );
          })}
        </div>
        <p className="cert-fine">Range certificates are practice credentials issued by this training range for the VICS Security Conclave 2026. They show what you&apos;ve done here; they aren&apos;t industry certifications.</p>
      </section>

      <section id="industry" className="cert-section">
        <h2 className="sec-h"><Icon name="resources" />Industry certifications</h2>
        <p className="cert-intro">
          Well-known certifications grouped by area and level, with what each one proves, who it&apos;s for, and the tracks
          here that build toward it. Signed in? Generate AI practice questions on any certification&apos;s topics.
        </p>
        <CertCatalog certs={industryCerts} trackTitles={trackTitles} signedIn={!!uid} />
        <p className="cert-fine">
          Reviewed {CERTS_REVIEWED}. Exam formats, prices and requirements change — always check the official page before
          you book. This site isn&apos;t affiliated with any certification body.
        </p>
      </section>

      <section id="roadmaps" className="cert-section">
        <h2 className="sec-h"><Icon name="flag" />Career roadmaps</h2>
        <p className="cert-intro">A suggested order for each role: tracks here, then Range certificates, then industry certifications. Skip what you already know.</p>
        <div className="road-list">
          {roadmaps.map((r) => (
            <div className="road" key={r.role}>
              <div className="road-h"><b>{r.role}</b><span>{r.blurb}</span></div>
              <ol className="road-steps">
                {r.steps.map((s, i) => {
                  const l = stepLabel(s);
                  return <li key={i} className={`road-step ${l.kind}`}><Link href={l.href}>{l.text}</Link></li>;
                })}
              </ol>
            </div>
          ))}
        </div>
        <div className="road-legend">
          <span className="road-step track">track here</span>
          <span className="road-step range">Range certificate</span>
          <span className="road-step cert">industry certification</span>
        </div>
      </section>
    </>
  );
}
