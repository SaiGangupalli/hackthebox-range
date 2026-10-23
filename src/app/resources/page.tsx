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
      {resources.map((g) => (
        <div key={g.g}>
          <div className="sec-h"><Icon name="resources" />{g.g}</div>
          <div className="labs">
            {g.items.map((it) => (
              <div className="lab" key={it.n}>
                <span className="lab-no">→</span>
                <div style={{ minWidth: 0 }}>
                  <b><a href={it.u} target="_blank" rel="noopener noreferrer">{it.n}</a></b>
                  <a className="link" href={it.u} target="_blank" rel="noopener noreferrer">
                    {it.u.replace(/^https?:\/\//, "")}
                  </a>
                  <p>{it.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
