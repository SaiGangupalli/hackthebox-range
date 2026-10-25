import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Keep personal and organizer pages out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api/", "/certify/", "/learning", "/review"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
