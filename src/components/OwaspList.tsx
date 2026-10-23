import Link from "next/link";
import type { Risk } from "@/data/owasp";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";

export function OwaspList({
  list, title, sub, eyebrow,
}: { list: Risk[]; title: string; sub: string; eyebrow: string }) {
  return (
    <>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="view-title">{title}</h1>
      <p className="lede">{sub}</p>

      <div className="callout info" style={{ marginBottom: 18 }}>
        <Icon name="book" />
        <div>
          Tap any risk to expand <b>how it works</b>, <b>how to find it</b> in an authorized lab,
          and <b>how to defend</b>. Pair this with the <Link href="/tracks/webmobile">Web &amp; Mobile</Link> track.
        </div>
      </div>

      <div className="owasp">
        {list.map((o) => (
          <details className="ow" key={o.c}>
            <summary>
              <span className="code">{o.c}</span>
              <span className="ow-name">{o.n}</span>
              <Icon name="caret" className="caret" />
            </summary>
            <div className="body">
              <div className="block how"><span className="bl">How it works</span><p>{o.how}</p></div>
              <div className="block test"><span className="bl">Find it (labs only)</span><p><InlineCode text={o.test} /></p></div>
              <div className="block fix"><span className="bl">Defend</span><p>{o.fix}</p></div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
