// Organizer-controlled site settings, stored in hhb_setting: the announcement
// banner, hidden challenges, banned players, and an audit log of admin actions.
// Reads are cached briefly because they sit on hot paths (every session check
// looks at the ban list); every write clears the cache.

import { prisma } from "./db";

export type Announcement = { text: string; level: "info" | "warn"; at: string; by: string };
export type AuditEntry = { at: string; by: string; action: string; target?: string };
export type Site = { announcement: Announcement | null; hidden: string[]; banned: string[] }; // banned = user ids

const TTL_MS = 10_000;
const EMPTY: Site = { announcement: null, hidden: [], banned: [] };

// The cache lives on globalThis, not in a module variable: the dev server can
// load this module once per route, and a write in /api/admin must clear the
// copy every other route reads.
const g = globalThis as { __hhbSiteCache?: { at: number; site: Site } | null };
const clearCache = () => { g.__hhbSiteCache = null; };

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function getSite(): Promise<Site> {
  const cached = g.__hhbSiteCache;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.site;
  const rows = await prisma.setting.findMany({ where: { key: { in: ["announcement", "hidden", "banned"] } } });
  const val = (k: string) => rows.find((r) => r.key === k)?.value;
  const a = val("announcement") as Announcement | undefined;
  const site: Site = { announcement: a?.text ? a : null, hidden: strings(val("hidden")), banned: strings(val("banned")) };
  g.__hhbSiteCache = { at: Date.now(), site };
  return site;
}

// For hot paths: if the database is unreachable, fall back to "nothing set"
// rather than failing the request.
export async function siteOrDefault(): Promise<Site> {
  try { return await getSite(); } catch { return EMPTY; }
}

export async function isBanned(uid: string): Promise<boolean> {
  return (await siteOrDefault()).banned.includes(uid);
}

async function put(key: string, value: object) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  clearCache();
}

export async function setAnnouncement(a: Announcement | null) {
  if (a) await put("announcement", a);
  else { await prisma.setting.deleteMany({ where: { key: "announcement" } }); clearCache(); }
}

export const setHidden = (ids: string[]) => put("hidden", [...new Set(ids)]);
export const setBanned = (ids: string[]) => put("banned", [...new Set(ids)]);

const AUDIT_MAX = 200;

export async function audit(by: string, action: string, target?: string) {
  const row = await prisma.setting.findUnique({ where: { key: "audit" } });
  const list = Array.isArray(row?.value) ? (row.value as AuditEntry[]) : [];
  const entry: AuditEntry = { at: new Date().toISOString(), by, action, ...(target ? { target } : {}) };
  await put("audit", [entry, ...list].slice(0, AUDIT_MAX));
}

export async function getAudit(): Promise<AuditEntry[]> {
  const row = await prisma.setting.findUnique({ where: { key: "audit" } });
  return Array.isArray(row?.value) ? (row.value as AuditEntry[]) : [];
}
