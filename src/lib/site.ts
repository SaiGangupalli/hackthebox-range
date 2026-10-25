// The public address of the site, for absolute links in share previews,
// robots.txt and the sitemap. Set SITE_URL in production (e.g. https://range.example.org).
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
export const SITE_NAME = "H@ck1h3B0x Range";
export const SITE_DESCRIPTION = "A hands-on defensive-security range for the VICS Security Conclave 2026: 13 guided tracks from beginner to advanced, in-browser labs, CTF challenges and certifications.";
