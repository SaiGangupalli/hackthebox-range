import { tracks, trackOrder } from "./tracks";

export type NavItem = { href: string; name: string; icon: string; num?: number; track?: boolean };
export type NavGroup = { g: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { g: "Start", items: [
    { href: "/", name: "Home", icon: "shield" },
    { href: "/ethics", name: "Rules of engagement", icon: "ethics" },
  ]},
  { g: "CTF tracks", items: trackOrder.map((slug) => ({
    href: `/tracks/${slug}`,
    name: tracks[slug].title,
    icon: slug,
    num: tracks[slug].num,
    track: true,
  }))},
  { g: "OWASP", items: [
    { href: "/owasp", name: "Web Top 10", icon: "owasp" },
    { href: "/llm", name: "LLM Top 10", icon: "llm" },
  ]},
  { g: "Lab", items: [
    { href: "/tools", name: "Lab tools", icon: "tools" },
    { href: "/resources", name: "Resources", icon: "resources" },
  ]},
];
