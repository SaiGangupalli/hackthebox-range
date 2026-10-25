"use client";

// Last-resort error screen if the root layout itself fails. It replaces the
// whole document, so it carries its own minimal styling.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0d13", color: "#e7eef6", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 460, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>H@ck1h3B0x Range is having trouble</h1>
          <p style={{ color: "#93a2b5", lineHeight: 1.5 }}>Something failed while loading the site. Your progress is saved — please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 12, background: "#ff3b47", color: "#fff", border: 0, borderRadius: 9, padding: "10px 18px", fontSize: 15, cursor: "pointer" }}>Try again</button>
          {error.digest && <p style={{ color: "#5f6e81", fontSize: 12, marginTop: 16 }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
