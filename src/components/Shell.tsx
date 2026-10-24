"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Icon } from "./icons";
import { navGroups } from "@/data/nav";
import { useProgress, hydrateProgress } from "@/lib/progress";
import { TutorPanel } from "./TutorPanel";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { map, count, total } = useProgress();
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => { hydrateProgress(); setMounted(true); }, []);
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // global toast
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      const el = toastRef.current;
      if (!el) return;
      el.textContent = (e as CustomEvent).detail ?? "done";
      el.classList.add("show");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("show"), 1200);
    };
    window.addEventListener("hhb-toast", onToast);
    return () => { window.removeEventListener("hhb-toast", onToast); clearTimeout(timer); };
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const isDark = cur ? cur === "dark" : !window.matchMedia("(prefers-color-scheme: light)").matches;
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("hhb_theme", next); } catch { /* ignore */ }
  }

  const q = query.toLowerCase();

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setNavOpen((v) => !v)}>
            <Icon name="menu" />
          </button>
          <Link href="/" className="brand" style={{ textDecoration: "none" }}>
            <span className="logo"><Icon name="shield" /></span>
            <span>
              <b>H@ck1h3B0x Range</b>
              <small>VICS Security Conclave 2026 · training lab</small>
            </span>
          </Link>
          <div className="top-spacer" />
          <AuthControl />
          <button className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
            <Icon name="sun" />
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="rail">
          <input
            className="search"
            type="text"
            placeholder="filter tracks…"
            aria-label="Filter navigation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="progress-wrap">
            <div className="pl"><span>progress</span><span><b>{mounted ? count : 0}</b>/{total}</span></div>
            <div className="bar"><i style={{ width: `${mounted ? (count / total) * 100 : 0}%` }} /></div>
          </div>
          <nav>
            {navGroups.map((grp) => {
              const items = grp.items.filter((it) => it.name.toLowerCase().includes(q));
              if (!items.length) return null;
              return (
                <div className="nav-group" key={grp.g}>
                  <div className="nav-label">{grp.g}</div>
                  {items.map((it) => {
                    const active = pathname === it.href;
                    const done = mounted && it.track && map[it.href.split("/").pop() as string];
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`nav-btn${active ? " active" : ""}${done ? " done" : ""}`}
                      >
                        {it.num ? (
                          <span className="num">{String(it.num).padStart(2, "0")}</span>
                        ) : (
                          <Icon name={it.icon} className="ic" />
                        )}
                        <span className="nav-txt">{it.name}</span>
                        {it.track ? <Icon name="check" className="chk" /> : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="scrim" onClick={() => setNavOpen(false)} />
        <main className="content"><div className="view">{children}</div></main>
      </div>

      <div className="toast" ref={toastRef} />
      <TutorPanel />
      <BodyNavClass open={navOpen} />
    </>
  );
}

// Header auth state: handle (linking to your profile) with your rank, plus
// logout when signed in; otherwise a sign-in link. Rank refreshes as you move
// around, since progress you make raises it.
function AuthControl() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [rank, setRank] = useState<{ rank: string; level: number } | null>(null);
  const name = session?.user?.name;
  useEffect(() => {
    if (!name) { setRank(null); return; }
    let cancelled = false;
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setRank(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [name, pathname]);
  if (status === "loading") return <span className="auth-chip skel" aria-hidden="true" />;
  if (session?.user) {
    return (
      <span className="auth-chip">
        <Link className="who" href={`/u/${session.user.name}`} title="Your profile">
          {session.user.name}
          {rank && <span className={`rank-chip r${rank.level}`}>{rank.rank}</span>}
        </Link>
        <button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={() => signOut({ callbackUrl: "/" })}>
          <Icon name="logout" />
        </button>
      </span>
    );
  }
  return <Link className="btn auth-signin" href="/login"><Icon name="shield" />Sign in</Link>;
}

// Toggle the body.nav-open class used by the mobile drawer CSS.
function BodyNavClass({ open }: { open: boolean }) {
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);
  return null;
}
