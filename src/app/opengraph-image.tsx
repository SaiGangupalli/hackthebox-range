import { ImageResponse } from "next/og";

export const alt = "H@ck1h3B0x Range — learn to break it, so you can defend it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default share preview for every page without its own.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "linear-gradient(135deg, #0a0d13 0%, #151c2a 100%)", color: "#e7eef6" }}>
        <div style={{ fontSize: 26, letterSpacing: 4, color: "#ff3b47", textTransform: "uppercase" }}>VICS Security Conclave 2026</div>
        <div style={{ fontSize: 84, fontWeight: 700, marginTop: 18 }}>H@ck1h3B0x Range</div>
        <div style={{ fontSize: 40, marginTop: 14, color: "#93a2b5" }}>Learn to break it, so you can defend it.</div>
        <div style={{ display: "flex", gap: 18, marginTop: 48, fontSize: 26 }}>
          {["13 tracks", "Beginner → Advanced", "In-browser labs", "CTF & certifications"].map((t) => (
            <div key={t} style={{ display: "flex", padding: "10px 20px", border: "2px solid #28313f", borderRadius: 999, color: "#e7eef6" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
