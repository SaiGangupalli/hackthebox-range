import Link from "next/link";
import { commandGroups, recipes, anatomy, describe, labsWith, practiceUses, practiceChains, drillFor } from "@/data/commands";
import { tracks } from "@/data/tracks";
import { Icon } from "@/components/icons";
import { PrintButton } from "@/components/PrintButton";
import { ExplainButton } from "@/components/ExplainButton";

export const metadata = { title: "H@ck1h3B0x Range — Command handbook" };

// Every command in the Range in plain English, grouped by what you're trying to
// do, with an example, every other way the drills and labs use it, and a tip.
// Prints to a clean PDF.
export default function CommandsPage() {
  const total = commandGroups.reduce((n, g) => n + g.commands.length, 0);
  const wireshark = tracks.network.sheets[0];
  const spl = tracks.splunk.sheets[0];

  return (
    <div className="cmddoc">
      <div className="eyebrow"><Icon name="os" />command handbook</div>
      <h1 className="view-title">Command handbook</h1>
      <p className="lede">
        All {total} commands you can type in the Range, explained in plain English — what each one does, an example to
        copy, every other way the <Link href="/commands/practice">practice drills</Link> and track labs use it, and a tip.
        Every example on this page runs in the practice terminal; the lab tools at the end run in their track&apos;s lab.
      </p>
      <div className="sheet-actions no-print">
        <Link className="btn primary" href="/commands/practice"><Icon name="zap" />Practise these commands</Link>
        <PrintButton className="btn" />
        <span className="sheet-hint">Opens your print dialog — choose “Save as PDF”. Tip: press Explain on any command for an AI walkthrough.</span>
      </div>

      <section className="cmd-anatomy">
        <h2>How to read a command</h2>
        <div className="anat-example">
          {anatomy.parts.map((p, i) => <span key={i} className={`anat-p a${i}`}>{p.part}</span>)}
        </div>
        <ul className="anat-parts">
          {anatomy.parts.map((p, i) => (
            <li key={i}><code className={`a${i}`}>{p.part}</code><b>{p.label}</b><span>{p.says}</span></li>
          ))}
        </ul>
        <div className="anat-extras">
          {anatomy.extras.map((x) => <div key={x.sym}><code>{x.sym}</code><span>{x.means}</span></div>)}
        </div>
      </section>

      {commandGroups.map((g) => (
        <section className="cmd-group" key={g.title}>
          <h2>{g.title}</h2>
          <p className="cmd-intro">{g.intro}</p>
          <div className="cmd-grid">
            {g.commands.map((c) => {
              const help = describe(c.name);
              if (!help) return null;
              const uses = practiceUses[c.name] ?? [];
              const inLabs = labsWith(c.name);
              return (
                <div className="cmd-card" key={c.name}>
                  <div className="cmd-top">
                    <code className="cmd-name">{c.name}</code>
                    <ExplainButton command={help[1]} />
                  </div>
                  <p className="cmd-does">{help[0].charAt(0).toUpperCase() + help[0].slice(1)}.</p>
                  <div className="cmd-ex"><span>example</span><code>{help[1]}</code></div>
                  {uses.length > 0 && (
                    <div className="cmd-uses">
                      <span>also in practice</span>
                      <ul>
                        {uses.map((u) => <li key={u.form}><Link href={u.href} title={u.label}><code>{u.form}</code></Link></li>)}
                      </ul>
                    </div>
                  )}
                  {inLabs.length > 0 && (
                    <p className="cmd-lab">In the {inLabs.map((l, i) => <span key={l.href}>{i > 0 && " and "}<Link href={l.href}>{l.title}</Link></span>)} lab{inLabs.length > 1 ? "s" : ""}</p>
                  )}
                  {c.tip && <p className="cmd-tip"><b>Tip</b> {c.tip}</p>}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="cmd-group">
        <h2>Put them together</h2>
        <p className="cmd-intro">Commands get powerful when you chain them with a pipe <code>|</code> — each one hands its output to the next. Every chain from the practice drills is here; press <b>Try it</b> to open that drill.</p>
        <table className="sheet-table">
          <thead><tr><th>Command</th><th>What it answers</th></tr></thead>
          <tbody>
            {[...recipes.map((r) => ({ ...r, href: drillFor(r.cmd) })), ...practiceChains].map((r) => (
              <tr key={r.cmd}>
                <td className="sheet-code"><code>{r.cmd}</code> <ExplainButton command={r.cmd} /></td>
                <td className="sheet-note">{r.does}{r.href && <> <Link className="cmd-try no-print" href={r.href}>Try it</Link></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cmd-group">
        <h2>Beyond the terminal</h2>
        <p className="cmd-intro">Two tools with their own mini-languages, from the <Link href="/tracks/network">Network</Link> and <Link href="/tracks/splunk">Splunk</Link> tracks.</p>
        {[wireshark, spl].map((sh) => (
          <table className="sheet-table" key={sh.title}>
            <caption>{sh.title}</caption>
            <thead><tr><th>Type this</th><th>What it does</th></tr></thead>
            <tbody>
              {sh.rows.map((r) => (
                <tr key={r.code}><td className="sheet-code"><code>{r.code}</code> <ExplainButton command={r.code} /></td><td className="sheet-note">{r.note}</td></tr>
              ))}
            </tbody>
          </table>
        ))}
      </section>

      <div className="sheet-foot">H@ck1h3B0x Range · command handbook · practise on systems you own or are authorized to test</div>
    </div>
  );
}
