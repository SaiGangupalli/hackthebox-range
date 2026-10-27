import { tracks } from "@/data/tracks";
import { pathOrder, pathIndex } from "@/data/path";
import { learn } from "@/data/learn";
import { quiz } from "@/data/quiz";
import { owasp } from "@/data/owasp";
import { llm } from "@/data/llm";
import { glossary, GLOSSARY_CATS } from "@/data/glossary";
import type { Risk } from "@/data/owasp";
import { Icon } from "@/components/icons";
import { InlineCode } from "@/components/InlineCode";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "H@ck1h3B0x Range — Cheatsheet" };

const num = (i: number) => String(i + 1).padStart(2, "0");

// Printable ASCII (32–126) with decimal and hex, for the reference appendix.
const ASCII = Array.from({ length: 95 }, (_, i) => {
  const dec = 32 + i;
  const ch = dec === 32 ? "SP" : String.fromCharCode(dec);
  return { dec, ch, hex: dec.toString(16).toUpperCase().padStart(2, "0") };
});

// One printable study guide for the whole range. Every track follows the same
// shape — overview, outcomes, concepts, commands, tools, defend, self-check —
// then appendices for the OWASP lists and the glossary. "Download PDF" prints
// it; the @media print rules in globals.css switch to a light, paper palette.
export default function CheatsheetPage() {
  return (
    <div className="sheetdoc">
      <header className="sheet-cover">
        <div className="eyebrow"><Icon name="book" />study guide</div>
        <h1 className="view-title">H@ck1h3B0x Range cheatsheet</h1>
        <p className="lede">
          All nine tracks in learning-path order, each laid out the same way, plus the OWASP Web &amp; LLM Top 10 and a
          glossary. Read it here, or save it as a PDF for offline study.
        </p>
        <div className="sheet-actions no-print">
          <PrintButton />
          <span className="sheet-hint">Opens your print dialog — choose “Save as PDF”. Turn on “Background graphics” for coloured labels.</span>
        </div>
        <ul className="sheet-howto">
          <li><b>Overview</b> what the track is about</li>
          <li><b>You can</b> what you&apos;ll be able to do</li>
          <li><b>Concepts</b> plain explanations with an example</li>
          <li><b>Commands</b> what to type, and what it does</li>
          <li><b>Defend</b> how to protect against it</li>
          <li><b>Self-check</b> questions, with answers</li>
        </ul>
        <p className="sheet-legal"><Icon name="shield" />Authorized use only — for CTF, your own lab, or systems you have written permission to test.</p>
      </header>

      <nav className="sheet-toc" aria-label="Contents">
        <div className="sheet-toc-h">Contents</div>
        <ul>
          {pathOrder.map((slug, i) => {
            const p = pathIndex[slug];
            return (
              <li key={slug}>
                <a href={`#${slug}`}>
                  <span className="toc-n">{num(i)}</span>
                  <span className="toc-t">{tracks[slug].title}</span>
                  <span className="toc-m">{p.level} · {p.minutes} min</span>
                </a>
              </li>
            );
          })}
          <li><a href="#owasp-web"><span className="toc-n">A</span><span className="toc-t">OWASP Web Top 10</span><span className="toc-m">appendix</span></a></li>
          <li><a href="#owasp-llm"><span className="toc-n">B</span><span className="toc-t">OWASP LLM Top 10</span><span className="toc-m">appendix</span></a></li>
          <li><a href="#ascii"><span className="toc-n">C</span><span className="toc-t">ASCII table</span><span className="toc-m">appendix</span></a></li>
          <li><a href="#glossary"><span className="toc-n">D</span><span className="toc-t">Glossary</span><span className="toc-m">{glossary.length} terms</span></a></li>
        </ul>
      </nav>

      {pathOrder.map((slug, i) => {
        const t = tracks[slug];
        const p = pathIndex[slug];
        const l = learn[slug];
        const qs = quiz[slug] ?? [];
        return (
          <section className="sheet-track" id={slug} key={slug}>
            <div className="sheet-head">
              <span className="sheet-num">{num(i)}</span>
              <div>
                <h2>{t.title}</h2>
                <div className="sheet-meta">{t.tag} · {p.level} · about {p.minutes} min</div>
              </div>
            </div>

            <h3 className="sheet-h3">Overview</h3>
            <p className="sheet-blurb">{t.blurb}</p>

            <h3 className="sheet-h3">After this track you can</h3>
            <ul className="sheet-outcomes">{p.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>

            {l && (
              <>
                <h3 className="sheet-h3">Key concepts</h3>
                <div className="sheet-concepts">
                  {l.cards.map((c, k) => (
                    <div className="sheet-concept" key={k}>
                      <h4><InlineCode text={c.q} /></h4>
                      <p><InlineCode text={c.a} /></p>
                      {c.worked && (
                        <div className="sheet-worked">
                          <div className="sw-row"><span className="sw-tag">you run</span><pre className="sw-in">{c.worked.input}</pre></div>
                          <div className="sw-row"><span className="sw-tag t-out">you get</span><pre className="sw-out">{c.worked.output}</pre></div>
                          <div className="sw-row"><span className="sw-tag t-read">meaning</span><p className="sw-read"><InlineCode text={c.worked.read} /></p></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="sheet-h3">Commands</h3>
            {t.sheets.map((sh) => (
              <table className="sheet-table" key={sh.title}>
                <caption>{sh.title}</caption>
                <thead><tr><th>Command</th><th>What it does</th></tr></thead>
                <tbody>
                  {sh.rows.map((r, k) => (
                    <tr key={k}><td className="sheet-code"><code>{r.code}</code></td><td className="sheet-note">{r.note}</td></tr>
                  ))}
                </tbody>
              </table>
            ))}

            <h3 className="sheet-h3">Tools professionals use</h3>
            <p className="sheet-tools">{t.tools.join(" · ")}</p>

            <h3 className="sheet-h3">Defend it</h3>
            <ul className="sheet-ticks">{t.defend.map((d) => <li key={d}>{d}</li>)}</ul>

            {qs.length > 0 && (
              <>
                <h3 className="sheet-h3">Self-check</h3>
                <ol className="sheet-quiz">
                  {qs.map((q) => (
                    <li key={q.q}>
                      <p className="sq-q">{q.q}</p>
                      <p className="sq-a"><b>Answer:</b> {q.right}. <span>{q.why}</span></p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        );
      })}

      <RiskAppendix id="owasp-web" letter="A" title="OWASP Web Top 10" intro="The ten most critical web application risks (2021): what each is, how it's found on a lab target, how it's fixed, and a vulnerable-vs-fixed example." risks={owasp} />
      <RiskAppendix id="owasp-llm" letter="B" title="OWASP LLM Top 10 (2025)" intro="The top risks for applications built on large language models, in the same format." risks={llm} />

      <section className="sheet-track" id="ascii">
        <div className="sheet-head">
          <span className="sheet-num">C</span>
          <div>
            <h2>ASCII table</h2>
            <div className="sheet-meta">appendix</div>
          </div>
        </div>
        <p className="sheet-blurb">
          Every printable character with its decimal and hex code — read hex or decimal by hand, or paste into the
          Encoder (Hex → text). Each character is one byte (8 bits). Handy anchors: A = 65 = 0x41, a = 97 = 0x61,
          0 = 48 = 0x30, space = 32 = 0x20, and the flag braces {"{"} = 123, {"}"} = 125.
        </p>
        <div className="ascii-grid">
          {ASCII.map((c) => (
            <div className="ascii-cell" key={c.dec}>
              <span className="ascii-ch">{c.ch}</span>
              <span className="ascii-code">{c.dec}</span>
              <span className="ascii-code">0x{c.hex}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet-track" id="glossary">
        <div className="sheet-head">
          <span className="sheet-num">D</span>
          <div>
            <h2>Glossary</h2>
            <div className="sheet-meta">{glossary.length} terms in plain English</div>
          </div>
        </div>
        {GLOSSARY_CATS.map((c) => (
          <div key={c}>
            <h3 className="sheet-h3">{c}</h3>
            <dl className="sheet-gl">
              {glossary.filter((g) => g.cat === c).sort((a, b) => a.term.localeCompare(b.term)).map((g) => (
                <div key={g.term}>
                  <dt>{g.term}</dt>
                  <dd>{g.def}{g.eg && <span className="sheet-gl-eg"> e.g. {g.eg}</span>}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <div className="sheet-foot">H@ck1h3B0x Range · VICS Security Conclave 2026 · defensive-security training · authorized use only</div>
    </div>
  );
}

function RiskAppendix({ id, letter, title, intro, risks }: { id: string; letter: string; title: string; intro: string; risks: Risk[] }) {
  return (
    <section className="sheet-track" id={id}>
      <div className="sheet-head">
        <span className="sheet-num">{letter}</span>
        <div>
          <h2>{title}</h2>
          <div className="sheet-meta">appendix</div>
        </div>
      </div>
      <p className="sheet-blurb">{intro}</p>
      <div className="sheet-risks">
        {risks.map((r) => (
          <div className="sheet-risk" key={r.c}>
            <h4><span className="sheet-risk-c">{r.c}</span>{r.n}</h4>
            <dl className="sr-rows">
              <div><dt>What</dt><dd><InlineCode text={r.how} /></dd></div>
              <div><dt>Find</dt><dd><InlineCode text={r.test} /></dd></div>
              <div><dt>Fix</dt><dd><InlineCode text={r.fix} /></dd></div>
            </dl>
            {r.example && (
              <div className="sheet-ex">
                <div className="sheet-ex-row bad"><span>vulnerable</span><pre>{r.example.bad}</pre></div>
                <div className="sheet-ex-row good"><span>fixed</span><pre>{r.example.good}</pre></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
