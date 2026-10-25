"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { glossary, GLOSSARY_CATS } from "@/data/glossary";
import { tracks } from "@/data/tracks";

// Searchable glossary: type to filter by term or definition, or narrow to one
// category. Terms are listed A–Z within each category.
export function GlossaryView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = glossary.filter((t) =>
      (!cat || t.cat === cat) &&
      (!needle || `${t.term} ${t.def} ${t.eg ?? ""}`.toLowerCase().includes(needle)));
    return GLOSSARY_CATS
      .map((c) => ({ cat: c, terms: hit.filter((t) => t.cat === c).sort((a, b) => a.term.localeCompare(b.term)) }))
      .filter((g) => g.terms.length);
  }, [q, cat]);

  const shown = groups.reduce((n, g) => n + g.terms.length, 0);

  return (
    <>
      <div className="eyebrow"><Icon name="book" />plain-English definitions</div>
      <h1 className="view-title">Glossary</h1>
      <p className="lede">Security is full of jargon. Every term here is explained in everyday words, most with a short example.</p>

      <div className="gl-tools">
        <div className="gl-search">
          <Icon name="osint" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a word, e.g. port, flag, DNS…"
            aria-label="Search the glossary"
            spellCheck={false}
          />
          {q && <button className="task-hintbtn" onClick={() => setQ("")}>clear</button>}
        </div>
        <div className="gl-cats">
          <button className={`gl-cat${cat === null ? " on" : ""}`} onClick={() => setCat(null)}>All</button>
          {GLOSSARY_CATS.map((c) => (
            <button key={c} className={`gl-cat${cat === c ? " on" : ""}`} onClick={() => setCat(cat === c ? null : c)}>{c}</button>
          ))}
        </div>
        <div className="gl-count">{shown} of {glossary.length} terms</div>
      </div>

      {groups.length === 0 ? (
        <div className="callout info"><Icon name="book" /><div>No terms match “{q}”. Try a shorter word.</div></div>
      ) : groups.map((g) => (
        <section key={g.cat}>
          <div className="sec-h"><Icon name="book" />{g.cat}</div>
          <dl className="gl-list">
            {g.terms.map((t) => (
              <div className="gl-term" key={t.term}>
                <dt>{t.term}</dt>
                <dd>
                  {t.def}
                  {t.eg && <span className="gl-eg"><b>Example</b>{t.eg}</span>}
                  {t.track && tracks[t.track] && <Link className="gl-track" href={`/tracks/${t.track}`}>Learn it in the {tracks[t.track].title} track →</Link>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}
