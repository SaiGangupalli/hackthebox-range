"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Risk } from "@/data/owasp";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { SqlLab } from "./labs/SqlLab";
import { PromptLab } from "./labs/PromptLab";
import { sqlLabs } from "@/data/labs/sqlLabs";
import { promptLabs } from "@/data/labs/promptLabs";

// The first clause of "how" doubles as a one-line summary on the collapsed card.
const summary = (how: string) => how.split(/ — |\. /)[0].replace(/\.$/, "");

export function OwaspList({
  list, title, sub, eyebrow,
}: { list: Risk[]; title: string; sub: string; eyebrow: string }) {
  const labCount = list.filter((o) => o.lab).length;
  const listRef = useRef<HTMLDivElement>(null);

  const setAll = (open: boolean) =>
    listRef.current?.querySelectorAll<HTMLDetailsElement>("details.ow").forEach((d) => { d.open = open; });
  const jump = (code: string) => {
    const d = document.getElementById(code) as HTMLDetailsElement | null;
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // A link straight to one risk (/llm#LLM05, e.g. from a certification's study guide) opens it.
  useEffect(() => {
    const open = () => { if (location.hash) jump(decodeURIComponent(location.hash.slice(1))); };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

      <div className="ow-index" aria-label="Jump to a risk">
        {list.map((o) => (
          <button key={o.c} className={`ow-idx${o.lab ? " has-lab" : ""}`} onClick={() => jump(o.c)}>
            <span className="ow-idx-c">{o.c}</span>
            <span className="ow-idx-n">{o.n}</span>
            {o.lab && <span className="ow-idx-lab"><Icon name="zap" /></span>}
          </button>
        ))}
      </div>

      <div className="ow-legend">
        <span className="lg how">How it works</span>
        <span className="lg test">Find it</span>
        <span className="lg ex">Example</span>
        <span className="lg fix">Defend</span>
        <span className="ow-legend-actions">
          <button className="task-hintbtn" onClick={() => setAll(true)}>Expand all</button>
          <button className="task-hintbtn" onClick={() => setAll(false)}>Collapse all</button>
        </span>
      </div>

      <div className="owasp" ref={listRef}>
        {list.map((o) => (
          <details className="ow" key={o.c} id={o.c}>
            <summary>
              <span className="code">{o.c}</span>
              <span className="ow-name">{o.n}<small>{summary(o.how)}</small></span>
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
