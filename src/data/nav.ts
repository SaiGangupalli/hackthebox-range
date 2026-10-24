import { tracks } from "./tracks";
import { pathOrder } from "./path";

export type NavItem = { href: string; name: string; icon: string; num?: number; track?: boolean };
export type NavGroup = { g: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { g: "Start", items: [
    { href: "/", name: "Home", icon: "shield" },
    { href: "/ethics", name: "Rules of engagement", icon: "ethics" },
    { href: "/glossary", name: "Glossary", icon: "book" },
  ]},
  // Tracks appear in learning-path order, numbered by their step in the path.
  { g: "Learning path", items: pathOrder.map((slug, i) => ({
    href: `/tracks/${slug}`,
    name: tracks[slug].title,
    icon: slug,
    num: i + 1,
    track: true,
  }))},
  { g: "OWASP", items: [
    { href: "/owasp", name: "Web Top 10", icon: "owasp" },
    { href: "/llm", name: "LLM Top 10", icon: "llm" },
  ]},
  { g: "Compete", items: [
    { href: "/quiz", name: "Quizzes", icon: "book" },
    { href: "/challenges", name: "Challenges", icon: "flag" },
    { href: "/scoreboard", name: "Scoreboard", icon: "trophy" },
    { href: "/teams", name: "Teams", icon: "network" },
  ]},
  { g: "Lab", items: [
    { href: "/tools", name: "Lab tools", icon: "tools" },
    { href: "/commands", name: "Command handbook", icon: "os" },
    { href: "/commands/practice", name: "Command practice", icon: "zap" },
    { href: "/cheatsheet", name: "Cheatsheet (PDF)", icon: "book" },
    { href: "/resources", name: "Resources", icon: "resources" },
  ]},
];
