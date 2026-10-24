import { resources } from "@/data/resources";
import { Icon } from "@/components/icons";

export const metadata = { title: "Resources · H@ck1h3B0x Range" };

export default function ResourcesPage() {
  return (
    <>
      <div className="eyebrow">// external ranges</div>
      <h1 className="view-title">Where to practice</h1>
      <p className="lede">
        Every platform below is built for legal, hands-on practice. Create an account, read their rules, and go earn flags.
      </p>
      <div className="callout info" style={{ marginBottom: 6 }}>
        <Icon name="flag" />
        <div>New to this? Start with the ones marked <b>Start here</b> — they guide you step by step, like the tracks on this site.</div>
      </div>
      {resources.map((g) => (
        <div key={g.g}>
          <div className="sec-h"><Icon name="resources" />{g.g}</div>
          <div className="res-grid">
            {g.items.map((it) => (
              <a className="res-card" key={it.n} href={it.u} target="_blank" rel="noopener noreferrer">
                <div className="res-top">
                  <b>{it.n}</b>
                  {it.start && <span className="res-start">Start here</span>}
                </div>
                <p>{it.d}</p>
                <span className="res-url">{it.u.replace(/^https?:\/\//, "")} ↗</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
