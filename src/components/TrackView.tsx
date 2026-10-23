"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { tracks } from "@/data/tracks";
import { Icon } from "./icons";
import { Copyable } from "./Copyable";
import { Learn } from "./Learn";
import { PracticeLab } from "./labs/PracticeLab";
import { useProgress, toggleDone } from "@/lib/progress";

export function TrackView({ slug }: { slug: string }) {
  const track = tracks[slug];
  const { map } = useProgress();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!track) return <p>Unknown track.</p>;
  const done = mounted && !!map[slug];

  return (
    <>
      <div className="eyebrow">Track {String(track.num).padStart(2, "0")} · {track.tag}</div>
      <h1 className="view-title">{track.title}</h1>
      <p className="lede">{track.blurb}</p>

      <button className={`btn${done ? "" : " primary"}`} onClick={() => toggleDone(slug)}>
        <Icon name={done ? "check" : "circle"} />
        {done ? "Studied" : "Mark as studied"}
      </button>

      <Learn slug={slug} />

      <PracticeLab slug={slug} />

      <div className="sec-h"><Icon name="zap" />Core skills</div>
      <div className="chips">
        {track.skills.map((s) => <span className="chip ac" key={s}>{s}</span>)}
      </div>

      <div className="sec-h"><Icon name="book" />Cheatsheet</div>
      <div className="card">
        {track.sheets.map((sh) => (
          <div className="sheet" key={sh.title}>
            <div className="sheet-t">{sh.title}</div>
            <div className="rows">
              {sh.rows.map((r, i) => (
                <div className="row" key={i}>
                  <Copyable text={r.code} />
                  <span className="note">{r.note}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sec-h"><Icon name="wrench" />Tools of the trade</div>
      <div className="chips">
        {track.tools.map((t) => <span className="chip" key={t}>{t}</span>)}
      </div>

      <div className="sec-h"><Icon name="osint" />Practice legally</div>
      <div className="labs">
        {track.labs.map((l, i) => (
          <div className="lab" key={l.name}>
            <span className="lab-no">0{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              {l.href ? (
                <b><Link href={l.href}>{l.name} →</Link></b>
              ) : (
                <>
                  <b>{l.name}</b>
                  <a className="link" href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.url.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
              <p>{l.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="sec-h"><Icon name="shield" />Blue-team · harden it</div>
      <div className="card">
        <ul className="ticks">
          {track.defend.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </div>
    </>
  );
}
