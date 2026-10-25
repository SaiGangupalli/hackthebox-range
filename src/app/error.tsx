"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

// Shown when a page throws. Details stay in the server/browser console; the
// player gets a calm message and a way to retry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="err-page">
      <div className="eyebrow"><Icon name="shield" />something went wrong</div>
      <h1 className="view-title">That page hit a snag</h1>
      <p className="lede">
        It&apos;s not you — something failed on our side (often the database being briefly unreachable). Your progress is
        saved. Try again in a moment, or head back home.
      </p>
      <div className="err-actions">
        <button className="btn primary" onClick={reset}><Icon name="zap" />Try again</button>
        <Link className="btn" href="/">Back to home</Link>
      </div>
      {error.digest && <p className="err-ref">Reference for the organizers: <code>{error.digest}</code></p>}
    </div>
  );
}
