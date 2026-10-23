"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { tracks, trackOrder } from "@/data/tracks";
import { Icon } from "@/components/icons";
import { useProgress } from "@/lib/progress";

export default function Home() {
  const { map } = useProgress();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <section className="hero">
        <div className="hero-tag">// VICS SECURITY CONCLAVE 2026 · CAPTURE THE FLAG</div>
        <h1>Learn to break it,<br />so you can <span className="mono">def3nd</span> it.</h1>
        <p>
          A hands-on range for the nine H@ck1h3B0x tracks plus the OWASP Web &amp; LLM Top 10.
          Study the concepts, grab the cheatsheets, and run the lab tools right here in your browser.
        </p>
        <div className="try-row">
          <Link className="btn primary" href="/tracks/osint"><Icon name="zap" />Start the tracks</Link>
          <Link className="btn" href="/tools"><Icon name="tools" />Open lab tools</Link>
          <Link className="btn" href="/ethics"><Icon name="shield" />Rules of engagement</Link>
        </div>
        <div className="statline">
          <span><b>9</b>CTF tracks</span>
          <span><b>10+10</b>OWASP risks</span>
          <span><b>6</b>browser lab tools</span>
          <span><b>100%</b>legal to practice</span>
        </div>
      </section>

      <div className="callout warn" style={{ marginBottom: 22 }}>
        <Icon name="shield" />
        <div>
          <b>Authorized use only.</b> Every technique here is for CTF, your own lab, or systems you have
          written permission to test. <Link href="/ethics">Read the rules of engagement</Link> before you touch a target.
        </div>
      </div>

      <div className="sec-h"><Icon name="osint" />The nine tracks</div>
      <div className="grid">
        {trackOrder.map((slug) => {
          const t = tracks[slug];
          const done = mounted && !!map[slug];
          return (
            <Link className={`tcard${done ? " done" : ""}`} href={`/tracks/${slug}`} key={slug}>
              <span className="tc-done" />
              <div className="tc-top">
                <span className="tc-num">{String(t.num).padStart(2, "0")}</span>
                <Icon name={slug} className="tc-ic" />
              </div>
              <h3>{t.title}</h3>
              <p>{t.tag}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
