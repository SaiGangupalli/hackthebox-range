import { payloadLibrary } from "@/data/payloads";
import { Icon } from "@/components/icons";
import { Copyable } from "@/components/Copyable";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "H@ck1h3B0x Range — Web payloads" };

export default function PayloadsPage() {
  return (
    <>
      <div className="eyebrow">// attack payloads</div>
      <h1 className="view-title">Web payloads</h1>
      <p className="lede">
        Copy-to-use test strings for the common web vulnerability classes — SQL injection, XSS, IDOR / BOLA and more —
        each paired with its defensive fix. Click a payload to copy it; replace <code>YOUR-HOST</code> and IDs with
        your own. Maps to the <a href="/owasp">OWASP Web Top 10</a> and the <a href="/tracks/webmobile">Web &amp; Mobile</a> track.
      </p>
      <div className="sheet-actions no-print" style={{ marginBottom: 10 }}>
        <PrintButton />
        <span className="sheet-hint">Opens your print dialog — choose “Save as PDF”. Turn on “Background graphics” for the OWASP tags.</span>
      </div>
      <div className="callout warn" style={{ marginBottom: 6 }}>
        <Icon name="ethics" />
        <div>
          For <b>authorized targets only</b> — your own labs (the SQL-injection and web labs on the Web &amp; Mobile track),
          CTF platforms, or an engagement you have written permission for. The identical payloads against a system you
          don&apos;t control are illegal. Each is shown with the fix because the point is to defend against them.
        </div>
      </div>

      {payloadLibrary.map((group) => (
        <div key={group.g}>
          <div className="sec-h">
            <Icon name="owasp" />{group.g}
            {group.owasp && <span className="pay-owasp">{group.owasp}</span>}
          </div>
          <p className="tk-note">{group.note}</p>
          <div className="pl-grid">
            {group.items.map((it) => (
              <div className="pl-card" key={it.t}>
                <div className="pl-t">{it.t}</div>
                <Copyable text={it.p} className="pl-prompt" />
                {it.d && <div className="pl-d">{it.d}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="callout info" style={{ marginTop: 20 }}>
        <Icon name="zap" />
        <div>
          Practise these safely in the Range: the <a href="/tracks/webmobile">Web &amp; Mobile</a> track has a SQL-injection
          lab and a &ldquo;find the flag in web &amp; mobile apps&rdquo; lab (UNION, reflected XSS, manifest audit), and{" "}
          <a href="/tools">Lab tools</a> decode JWTs and encodings in the browser.
        </div>
      </div>
    </>
  );
}
