"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { learn, lessonId } from "@/data/learn";

// Beginner "Start here" cards for a track: a plain question, a plain answer, and
// an optional worked example (input → output → how to read it). Open by default
// so newcomers see them first; people who know the basics can collapse them.
export function Learn({ slug, heading }: { slug: string; heading?: React.ReactNode }) {
  const data = learn[slug];
  const [open, setOpen] = useState(true);
  if (!data) return null;

  return (
    <>
      {heading ?? <div className="sec-h"><Icon name="book" />Start here — the basics</div>}
      <p className="learn-intro">{data.intro}</p>
      <button className="btn learn-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="book" />
        {open ? "Collapse the cards (I know this)" : `Show the ${data.cards.length} beginner cards`}
      </button>

      {open && (
        <div className="learn-cards">
          {data.cards.map((c, i) => (
            <div className="learn-card" key={i} id={lessonId(c.q)}>
              <div className="learn-q"><span className="learn-no">{i + 1}</span><h3><InlineCode text={c.q} /></h3></div>
              <p className="learn-a"><InlineCode text={c.a} /></p>
              {c.worked && (
                <div className="worked">
                  <div className="worked-row">
                    <span className="worked-tag">you run</span>
                    <pre className="worked-in">{c.worked.input}</pre>
                  </div>
                  <div className="worked-row">
                    <span className="worked-tag t-out">you get</span>
                    <pre className="worked-out">{c.worked.output}</pre>
                  </div>
                  <div className="worked-row">
                    <span className="worked-tag t-read">how to read it</span>
                    <p className="worked-read"><InlineCode text={c.worked.read} /></p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
