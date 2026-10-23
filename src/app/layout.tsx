import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "H@ck1h3B0x Range",
  description:
    "A defensive-security CTF training hub — 9 tracks, OWASP Web & LLM Top 10, cheatsheets, and safe in-browser lab tools. For authorized / CTF use only.",
};

// Set the saved theme before paint to avoid a flash of the wrong palette.
const themeScript = `try{var t=localStorage.getItem('hhb_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
