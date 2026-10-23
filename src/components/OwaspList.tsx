"use client";
import Link from "next/link";
import type { Risk } from "@/data/owasp";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { SqlLab } from "./labs/SqlLab";
import { PromptLab } from "./labs/PromptLab";
import { sqlLabs } from "@/data/labs/sqlLabs";
import { promptLabs } from "@/data/labs/promptLabs";

export function OwaspList({
  list, title, sub, eyebrow,
}: { list: Risk[]; title: string; sub: string; eyebrow: string }) {
  const labCount = list.filter((o) => o.lab).length;
  return (
    <>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="view-title">{title}</h1>
      <p className="lede">{sub}</p>

      <div className="callout info" style={{ marginBottom: 18 }}>
        <Icon name="book" />
        <div>
          Tap any risk for <b>how it works</b>, <b>how to find it</b> in an authorized lab, a concrete
          <b> vulnerable → fixed example</b>, and <b>how to defend</b>.
          {labCount > 0 && <> {labCount} risk{labCount > 1 ? "s have" : " has"} a <b>live lab session</b> you can run in the page.</>}{" "}
          Pair this with the <Link href="/tracks/webmobile">Web &amp; Mobile</Link> and <Link href="/tracks/genai">GenAI</Link> tracks.
        </div>
      </div>

      <div className="owasp">
        {list.map((o) => (
          <details className="ow" key={o.c} id={o.c}>
            <summary>
              <span className="code">{o.c}</span>
              <span className="ow-name">{o.n}</span>
              {o.lab && <span className="ow-lab-badge"><Icon name="zap" />lab</span>}
              <Icon name="caret" className="caret" />
            </summary>
            <div className="body">
              <div className="block how"><span className="bl">How it works</span><p>{o.how}</p></div>
              <div className="block test"><span className="bl">Find it (labs only)</span><p><InlineCode text={o.test} /></p></div>

              {o.example && (
                <div className="block ex">
                  <span className="bl">Example</span>
                  <div className="ow-ex">
                    <div className="ow-ex-row bad">
                      <span className="ow-ex-tag">vulnerable</span>
                      <pre>{o.example.bad}</pre>
                    </div>
                    <div className="ow-ex-row good">
                      <span className="ow-ex-tag">fixed</span>
                      <pre>{o.example.good}</pre>
                    </div>
                    {o.example.note && <p className="ow-ex-note"><InlineCode text={o.example.note} /></p>}
                  </div>
                </div>
              )}

              <div className="block fix"><span className="bl">Defend</span><p>{o.fix}</p></div>

              {o.lab === "sqli" && (
                <div className="ow-lab">
                  <div className="bl lab-bl"><Icon name="zap" />Live lab session</div>
                  <SqlLab lab={sqlLabs.webmobile} />
                </div>
              )}
              {o.lab === "prompt" && (
                <div className="ow-lab">
                  <div className="bl lab-bl"><Icon name="zap" />Live lab session</div>
                  <PromptLab lab={promptLabs.genai} />
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
