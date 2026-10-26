import { toolkit } from "@/data/toolkit";
import { Icon } from "@/components/icons";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "H@ck1h3B0x Range — CTF toolkit" };

export default function ToolkitPage() {
  return (
    <>
      <div className="eyebrow">// tools of the trade</div>
      <h1 className="view-title">CTF toolkit</h1>
      <p className="lede">
        The tools that crack each kind of challenge — online versions you can open now, and how to install
        and run each one on Kali Linux. Grouped to match the tracks and the “Where flags hide” lab.
      </p>
      <div className="sheet-actions no-print" style={{ marginBottom: 10 }}>
        <PrintButton />
        <span className="sheet-hint">Opens your print dialog — choose “Save as PDF”. Turn on “Background graphics” for the coloured tags.</span>
      </div>
      <div className="callout warn" style={{ marginBottom: 6 }}>
        <Icon name="ethics" />
        <div>
          Use these only on systems you’re allowed to test — your own labs, the practice platforms in{" "}
          <a href="/resources">Resources</a>, or an engagement you have written permission for. The same tool is
          legal on a CTF box and a crime against someone else’s server.
        </div>
      </div>

      {toolkit.map((group) => (
        <div key={group.g}>
          <div className="sec-h"><Icon name="tools" />{group.g}</div>
          <p className="tk-note">{group.note}</p>
          <div className="tk-grid">
            {group.items.map((t) => (
              <div className="tk-card" key={t.n}>
                <div className="tk-top">
                  <b>{t.n}</b>
                  {t.on && (
                    <a className="tk-online" href={t.on} target="_blank" rel="noopener noreferrer">
                      online ↗
                    </a>
                  )}
                </div>
                <p>{t.d}</p>
                {t.k && (
                  <div className="tk-line">
                    <span className="tk-tag">install</span>
                    <code>{t.k}</code>
                  </div>
                )}
                {t.x && (
                  <div className="tk-line">
                    <span className="tk-tag use">use</span>
                    <code>{t.x}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="callout info" style={{ marginTop: 20 }}>
        <Icon name="zap" />
        <div>
          Many encodings and ciphers you can solve right here — the{" "}
          <a href="/tools">Lab tools</a> have a Base64/hex/ROT13/Atbash decoder, a cipher playground and a hash
          identifier, no install needed.
        </div>
      </div>
    </>
  );
}
