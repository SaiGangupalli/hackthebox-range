import { ImageResponse } from "next/og";
import { findCertificate, CODE_RE } from "@/lib/certify/exam";

export const runtime = "nodejs";
export const alt = "A verified H@ck1h3B0x Range certificate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LEVEL_COLOR: Record<string, string> = { Beginner: "#43d183", Intermediate: "#f6b84b", Advanced: "#c08bff" };

// Share preview for a certificate link: who earned what, at which level.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = CODE_RE.test(code) ? await findCertificate(code).catch(() => null) : null;
  const color = found ? LEVEL_COLOR[found.cert.level] ?? "#c08bff" : "#ff3b47";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 28, background: "#0a0d13" }}>
        {/* Two nested solid borders make the certificate frame (the renderer has no "double" style). */}
        <div style={{ flex: 1, display: "flex", border: `3px solid ${color}`, borderRadius: 26, padding: 8 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: `2px solid ${color}`, borderRadius: 18, background: "linear-gradient(160deg, #111722 0%, #0a0d13 100%)", color: "#e7eef6", textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 24, letterSpacing: 4, color: "#93a2b5", textTransform: "uppercase" }}>H@ck1h3B0x Range · VICS Security Conclave 2026</div>
          {found ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 30, color: "#93a2b5", marginTop: 34 }}>This certifies that</div>
              <div style={{ fontSize: 76, fontWeight: 700, marginTop: 6 }}>{found.handle}</div>
              <div style={{ fontSize: 30, color: "#93a2b5", marginTop: 6 }}>has earned</div>
              <div style={{ fontSize: 50, fontWeight: 700, marginTop: 8 }}>{found.cert.name}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 26, fontSize: 26 }}>
                <div style={{ display: "flex", padding: "6px 18px", borderRadius: 999, border: `2px solid ${color}`, color }}>{found.cert.level}</div>
                <div style={{ display: "flex", padding: "6px 18px", borderRadius: 999, border: "2px solid #28313f" }}>{found.record.pct}% on the exam</div>
                <div style={{ display: "flex", padding: "6px 18px", borderRadius: 999, border: "2px solid #28313f" }}>{found.record.code}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 48, marginTop: 40 }}>Certificate not found</div>
          )}
        </div>
        </div>
      </div>
    ),
    size,
  );
}
