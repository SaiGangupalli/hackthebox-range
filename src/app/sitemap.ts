import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { pathOrder } from "@/data/path";

// Public, shareable pages only (no per-player or organizer pages).
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/ethics", "/glossary", "/challenges", "/scoreboard", "/quiz", "/certifications", "/owasp", "/llm", "/tools", "/commands", "/commands/practice", "/cheatsheet", "/resources"];
  return [...pages, ...pathOrder.map((s) => `/tracks/${s}`)].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.7 }));
}
