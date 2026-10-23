import { tracks, trackOrder } from "@/data/tracks";
import { learn } from "@/data/learn";
import { owasp } from "@/data/owasp";
import { llm } from "@/data/llm";
import type { Risk } from "@/data/owasp";
import { Icon } from "@/components/icons";
import { InlineCode } from "@/components/InlineCode";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "H@ck1h3B0x Range — Combined Cheatsheet" };

// One detailed, printable reference across every track: key concepts with
// worked examples, command cheatsheets, tools, and blue-team defenses, plus the
// OWASP Web & LLM Top 10. "Download PDF" prints it (see @media print in globals).
export default function CheatsheetPage() {
  return (
    <div className="sheetdoc">
      <div className="eyebrow"><Icon name="book" />complete reference</div>
      <h1 className="view-title">Combined cheatsheet</h1>
      <p className="lede">
        Every track in one place — concepts explained with worked examples, command references, tools, and how to
        defend against each. Use <b>Download PDF</b> to save it for offline study.
      </p>
      <div className="sheet-actions no-print">
        <PrintButton />
        <span className="sheet-hint">Opens your print dialog — choose “Save as PDF”.</span>
      </div>

      <div className="callout warn sheet-banner">
        <Icon name="shield" />
        <div><b>Authorized use only.</b> Everything here is for CTF, your own lab, or systems you have written permission to test.</div>
      </div>

      <nav className="sheet-toc" aria-label="Contents">
        <div className="sheet-toc-h">Contents</div>
        <ol>
          {trackOrder.map((slug) => (
            <li key={slug}><a href={`#${slug}`}>{String(tracks[slug].num).padStart(2, "0")} · {tracks[slug].title}</a></li>
          ))}
          <li><a href="#owasp-web">A · OWASP Web Top 10</a></li>
          <li><a href="#owasp-llm">B · OWASP LLM Top 10</a></li>
        </ol>
      </nav>

      {trackOrder.map((slug) => {
        const t = tracks[slug];
        const l = learn[slug];
        return (
          <section className="sheet-track" id={slug} key={slug}>
            <h2 className="sheet-h2"><span className="sheet-num">{String(t.num).padStart(2, "0")}</span>{t.title}<span className="sheet-tag">{t.tag}</span></h2>
            <p className="sheet-blurb">{t.blurb}</p>

            <div className="sheet-chips"><b>Core skills:</b> {t.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>

            {l && (
              <>
                <h3 className="sheet-h3">Key concepts</h3>
                <p className="sheet-intro">{l.intro}</p>
                <div className="sheet-concepts">
                  {l.cards.map((c, i) => (
                    <div className="sheet-concept" key={i}>
                      <h4><InlineCode text={c.q} /></h4>
                      <p><InlineCode text={c.a} /></p>
                      {c.worked && (
                        <div className="sheet-worked">
                          <div><span className="sw-tag">example</span><code className="sw-in">{c.worked.input}</code></div>
                          <div><span className="sw-tag out">result</span><code className="sw-out">{c.worked.output}</code></div>
                          <div><span className="sw-tag read">reading it</span><span className="sw-read"><InlineCode text={c.worked.read} /></span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="sheet-h3">Command cheatsheet</h3>
            {t.sheets.map((sh) => (
              <div className="sheet-cmds" key={sh.title}>
                <div className="sheet-cmds-t">{sh.title}</div>
                <table className="sheet-table">
                  <tbody>
                    {sh.rows.map((r, i) => (
                      <tr key={i}><td className="sheet-code"><code>{r.code}</code></td><td className="sheet-note">{r.note}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <h3 className="sheet-h3">Tools</h3>
            <div className="sheet-chips">{t.tools.map((x) => <span className="chip" key={x}>{x}</span>)}</div>

            <h3 className="sheet-h3">Defend it (blue team)</h3>
            <ul className="sheet-ticks">{t.defend.map((d) => <li key={d}>{d}</li>)}</ul>
          </section>
        );
      })}

      <RiskAppendix id="owasp-web" letter="A" title="OWASP Web Top 10" risks={owasp} />
      <RiskAppendix id="owasp-llm" letter="B" title="OWASP LLM Top 10 (2025)" risks={llm} />

      <div className="sheet-foot">H@ck1h3B0x Range · VICS Security Conclave 2026 · defensive-security training · authorized use only</div>
    </div>
  );
}

function RiskAppendix({ id, letter, title, risks }: { id: string; letter: string; title: string; risks: Risk[] }) {
  return (
    <section className="sheet-track" id={id}>
      <h2 className="sheet-h2"><span className="sheet-num">{letter}</span>{title}</h2>
      <div className="sheet-risks">
        {risks.map((r) => (
          <div className="sheet-risk" key={r.c}>
            <h4><span className="sheet-risk-c">{r.c}</span>{r.n}</h4>
            <p><b className="sr-how">What</b> <InlineCode text={r.how} /></p>
            <p><b className="sr-test">Test</b> <InlineCode text={r.test} /></p>
            <p><b className="sr-fix">Fix</b> <InlineCode text={r.fix} /></p>
            {r.example && (
              <div className="sheet-ex">
                <div className="sheet-ex-row bad"><span>vulnerable</span><code>{r.example.bad}</code></div>
                <div className="sheet-ex-row good"><span>fixed</span><code>{r.example.good}</code></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
