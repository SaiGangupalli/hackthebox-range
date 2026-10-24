import { Icon } from "@/components/icons";

export const metadata = { title: "Rules of engagement · H@ck1h3B0x Range" };

const rules: { b: string; rest: string }[] = [
  { b: "Authorization first.", rest: " Only test systems you own or have explicit, written permission to test. CTF platforms grant that permission within their scope." },
  { b: "Stay in scope.", rest: " Do not touch hosts, accounts, or data outside the defined target — not even to “look”." },
  { b: "Do no harm.", rest: " No destruction, no denial of service, no accessing real personal data. Prove the issue, then stop." },
  { b: "Handle findings responsibly.", rest: " Report vulnerabilities through proper disclosure channels; never exploit or sell them." },
  { b: "Protect data.", rest: " If you encounter real sensitive data during authorized testing, stop, document, and report it." },
  { b: "Know the law.", rest: " Unauthorized access is a crime in most jurisdictions regardless of intent. When unsure, get permission in writing." },
];

export default function EthicsPage() {
  return (
    <>
      <div className="eyebrow"><Icon name="shield" />rules of engagement</div>
      <h1 className="view-title">Hack ethically</h1>
      <p className="lede">
        H@ck1h3B0x is an ethical-hacking game. The same skills that win flags cause real harm off-scope. These are the lines.
      </p>
      <div className="rules">
        {rules.map((r, i) => (
          <div className="rule" key={r.b}>
            <span className="rule-n">{i + 1}</span>
            <div><b>{r.b}</b><p>{r.rest.trim()}</p></div>
          </div>
        ))}
      </div>
      <div className="callout warn" style={{ marginTop: 16 }}>
        <Icon name="shield" />
        <div>
          <b>This range is for learning defense.</b> Use the lab tools here freely; use everything else only where you
          are authorized. Verizon confidential — internal training use.
        </div>
      </div>
    </>
  );
}
