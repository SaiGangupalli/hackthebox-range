// Organizer-controlled site settings, stored in hhb_setting: the announcement
// banner, event times, hidden challenges, banned players, and an audit log of
// admin actions.
// Reads are cached briefly because they sit on hot paths (every session check
// looks at the ban list); every write clears the cache.

import { prisma } from "./db";
import { eventInfo, envTimes, type EventInfo, type EventTimes } from "./event";

export type Announcement = { text: string; level: "info" | "warn"; at: string; by: string };
export type AuditEntry = { at: string; by: string; action: string; target?: string };
// event: times set in the console, or null to use the EVENT_* env vars.
export type Site = { announcement: Announcement | null; event: EventTimes | null; hidden: string[]; banned: string[] }; // banned = user ids

const TTL_MS = 10_000;
const EMPTY: Site = { announcement: null, event: null, hidden: [], banned: [] };

// The cache lives on globalThis, not in a module variable: the dev server can
// load this module once per route, and a write in /api/admin must clear the
// copy every other route reads.
const g = globalThis as { __hhbSiteCache?: { at: number; site: Site } | null };
const clearCache = () => { g.__hhbSiteCache = null; };

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const isoOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
function times(v: unknown): EventTimes | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  return { start: isoOrNull(o.start), end: isoOrNull(o.end), freeze: isoOrNull(o.freeze) };
}

export async function getSite(): Promise<Site> {
  const cached = g.__hhbSiteCache;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.site;
  const rows = await prisma.setting.findMany({ where: { key: { in: ["announcement", "event", "hidden", "banned"] } } });
  const val = (k: string) => rows.find((r) => r.key === k)?.value;
  const a = val("announcement") as Announcement | undefined;
  const site: Site = { announcement: a?.text ? a : null, event: times(val("event")), hidden: strings(val("hidden")), banned: strings(val("banned")) };
  g.__hhbSiteCache = { at: Date.now(), site };
  return site;
}

// For hot paths: if the database is unreachable, fall back to "nothing set"
// rather than failing the request.
export async function siteOrDefault(): Promise<Site> {
  try { return await getSite(); } catch { return EMPTY; }
}

// The event state right now, from console times if set, else the env vars.
// Every check that depends on the event (submissions, freeze, banners) uses this.
export async function getEvent(now = new Date()): Promise<EventInfo> {
  return eventInfo(now, (await siteOrDefault()).event ?? envTimes());
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

// null goes back to the EVENT_* env vars.
export async function setEventTimes(t: EventTimes | null) {
  if (t) await put("event", t);
  else { await prisma.setting.deleteMany({ where: { key: "event" } }); clearCache(); }
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
