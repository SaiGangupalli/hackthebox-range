"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { InlineCode } from "./InlineCode";
import { learn } from "@/data/learn";

// Beginner "Start here" cards for a track: a plain question, a plain answer, and
// an optional worked example (input → output → how to read it). Collapsible so
// the page stays scannable for people who already know the basics.
export function Learn({ slug }: { slug: string }) {
  const data = learn[slug];
  const [open, setOpen] = useState(false);
  if (!data) return null;

  return (
    <>
      <div className="sec-h"><Icon name="book" />Start here — the basics</div>
      <p className="learn-intro">{data.intro}</p>
      <button className="btn learn-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name={open ? "circle" : "book"} />
        {open ? "Hide the beginner cards" : `Show ${data.cards.length} beginner cards with examples`}
      </button>

      {open && (
        <div className="learn-cards">
          {data.cards.map((c, i) => (
            <div className="learn-card" key={i}>
              <div className="learn-q"><span className="learn-no">{i + 1}</span><h3><InlineCode text={c.q} /></h3></div>
              <p className="learn-a"><InlineCode text={c.a} /></p>
              {c.worked && (
                <div className="worked">
                  <div className="worked-row">
                    <span className="worked-tag">you run</span>
                    <pre className="worked-in">{c.worked.input}</pre>
                  </div>
                  <div className="worked-row">
                    <span className="worked-tag out">you get</span>
                    <pre className="worked-out">{c.worked.output}</pre>
                  </div>
                  <div className="worked-row">
                    <span className="worked-tag read">how to read it</span>
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
