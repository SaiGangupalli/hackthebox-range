// CSV for the organizer exports. Text cells that start with = + - @ (or a tab
// or carriage return) get a leading ' so spreadsheet apps show them as text
// instead of running them as formulas (CSV injection). Numbers are left alone,
// so negative scores stay numbers.

export function csvCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// A byte-order mark first so Excel reads the file as UTF-8.
export const toCsv = (header: string[], rows: unknown[][]) =>
  "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
