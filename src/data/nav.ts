import { tracks } from "./tracks";
import { path, LEVELS } from "./path";

export type NavItem = { href: string; name: string; icon: string; num?: number; track?: boolean };
export type NavGroup = { g: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { g: "Start", items: [
    { href: "/", name: "Home", icon: "shield" },
    { href: "/learning", name: "My learning", icon: "trophy" },
    { href: "/review", name: "Flashcards", icon: "zap" },
    { href: "/ethics", name: "Rules of engagement", icon: "ethics" },
    { href: "/glossary", name: "Glossary", icon: "book" },
  ]},
  // Tracks appear in learning-path order, grouped by level and numbered by
  // their step in the path.
  ...LEVELS.map((level) => ({
    g: level,
    items: path.flatMap((p, i) => (p.level === level ? [{ href: `/tracks/${p.slug}`, name: tracks[p.slug].title, icon: p.slug, num: i + 1, track: true }] : [])),
  })),
  { g: "OWASP", items: [
    { href: "/owasp", name: "Web Top 10", icon: "owasp" },
    { href: "/llm", name: "LLM Top 10", icon: "llm" },
  ]},
  { g: "Compete", items: [
    { href: "/quiz", name: "Quizzes", icon: "book" },
    { href: "/challenges", name: "Challenges", icon: "flag" },
    { href: "/certifications", name: "Certifications", icon: "cert" },
    { href: "/scoreboard", name: "Scoreboard", icon: "trophy" },
    { href: "/teams", name: "Teams", icon: "network" },
  ]},
  { g: "Lab", items: [
    { href: "/tools", name: "Lab tools", icon: "tools" },
    { href: "/toolkit", name: "CTF toolkit", icon: "flag" },
    { href: "/prompts", name: "AI prompts", icon: "llm" },
    { href: "/commands", name: "Command handbook", icon: "os" },
    { href: "/commands/practice", name: "Command practice", icon: "zap" },
    { href: "/cheatsheet", name: "Cheatsheet (PDF)", icon: "book" },
    { href: "/resources", name: "Resources", icon: "resources" },
  ]},
];
