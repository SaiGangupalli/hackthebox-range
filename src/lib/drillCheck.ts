import type { Shell } from "./sim/shell";

// How a command-dojo drill decides you've done it. Every field is optional and
// all given fields must hold.
export type DrillCheck = {
  uses?: string[]; // every one of these programs appears in the command
  usesAny?: string[]; // at least one of these programs appears
  cmdRe?: string; // the command matches this regex
  out?: string[]; // the output contains all of these
  outNot?: string[]; // …and none of these
  outRe?: string; // the output matches this regex (multiline)
  exact?: string; // the output is exactly this (trailing spaces ignored)
  cwd?: string; // you ended up in this folder
  file?: { paths: string[]; has?: string[]; not?: string[]; lines?: number }; // one of these files now exists with this content
};

// Programs used anywhere in a command line: the first word of each pipeline
// stage (split on | ; &&).
export function programsIn(cmd: string): string[] {
  return cmd.split(/\|\||&&|[|;]/).map((seg) => seg.trim().split(/\s+/)[0]).filter(Boolean);
}

const norm = (s: string) => s.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");

export function passesDrill(c: DrillCheck, cmd: string, out: string, shell: Shell): boolean {
  const progs = programsIn(cmd);
  if (c.uses && !c.uses.every((p) => progs.includes(p))) return false;
  if (c.usesAny && !c.usesAny.some((p) => progs.includes(p))) return false;
  if (c.cmdRe && !new RegExp(c.cmdRe).test(cmd)) return false;
  if (c.out && !c.out.every((s) => out.includes(s))) return false;
  if (c.outNot && c.outNot.some((s) => out.includes(s))) return false;
  if (c.outRe && !new RegExp(c.outRe, "m").test(out)) return false;
  if (c.exact !== undefined && norm(out) !== norm(c.exact)) return false;
  if (c.cwd && shell.cwd !== c.cwd) return false;
  if (c.file) {
    const f = c.file;
    const ok = f.paths.some((p) => {
      const data = shell.files.get(p);
      if (data === undefined) return false;
      if (f.has && !f.has.every((s) => data.includes(s))) return false;
      if (f.not && f.not.some((s) => data.includes(s))) return false;
      if (f.lines !== undefined && data.replace(/\n$/, "").split("\n").length !== f.lines) return false;
      return true;
    });
    if (!ok) return false;
  }
  return true;
}
