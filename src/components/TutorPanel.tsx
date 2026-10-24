"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "./icons";
import { Markdown } from "./Markdown";
import { TUTOR_EVENT, type TutorAsk } from "@/lib/tutor";
import { tracks } from "@/data/tracks";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };
const RESET = "\u0000RESET\u0000";

function where(pathname: string): { label: string; slug: string | null } {
  const m = /^\/tracks\/([a-z]+)/.exec(pathname);
  if (m && tracks[m[1]]) return { label: `${tracks[m[1]].title} track`, slug: m[1] };
  if (pathname === "/owasp") return { label: "OWASP Web Top 10", slug: null };
  if (pathname === "/llm") return { label: "OWASP LLM Top 10", slug: null };
  return { label: "the whole site", slug: null };
}

// The AI tutor: a floating button plus a side panel. Opened by the button or by
// askTutor() from Explain / Nudge / Explain-more buttons around the site.
export function TutorPanel() {
  const { status } = useSession();
  const pathname = usePathname();
  const ctx = where(pathname);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;

  const scroll = () => requestAnimationFrame(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; });

  async function send(ask: TutorAsk, label: string) {
    if (busy) return;
    const history = msgsRef.current.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: label }, { role: "assistant", content: "" }]);
    setBusy(true);
    scroll();
    const ac = new AbortController();
    abortRef.current = ac;
    const setLast = (fn: (s: string) => string, error = false) =>
      setMsgs((m) => { const c = [...m]; const last = c[c.length - 1]; c[c.length - 1] = { ...last, content: fn(last.content), error }; return c; });
    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ask, history, page: pathname }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setLast(() => data.error ?? "The tutor couldn't answer right now.", true);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setLast((s) => {
          const joined = s + chunk;
          const at = joined.lastIndexOf(RESET);
          return at >= 0 ? joined.slice(at + RESET.length) : joined;
        });
        scroll();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setLast((s) => s || "Network error — please try again.", true);
    } finally {
      setBusy(false);
      abortRef.current = null;
      scroll();
    }
  }

  // Requests from elsewhere on the page (Explain / Nudge / Explain more).
  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent).detail as { ask: TutorAsk; label: string } | null;
      setOpen(true);
      if (d && status === "authenticated") send(d.ask, d.label);
      scroll();
    };
    window.addEventListener(TUTOR_EVENT, onAsk);
    return () => window.removeEventListener(TUTOR_EVENT, onAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, busy, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const suggestions = ctx.slug
    ? ["Explain this track as if I'm completely new", "What's the most important idea to learn here?", "Give me a hint for this track's lab"]
    : ["Where should a complete beginner start?", "What's the difference between encoding and encryption?", "How do I get better at CTFs?"];

  function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    send({ kind: "chat", text }, text);
  }

  return (
    <>
      <button className={`tutor-fab no-print${open ? " hidden" : ""}`} onClick={() => { setOpen(true); scroll(); }} aria-label="Ask the AI tutor">
        <Icon name="llm" /><span>Ask the tutor</span>
      </button>

      {open && (
        <aside className="tutor no-print" role="dialog" aria-label="AI tutor">
          <div className="tutor-head">
            <div>
              <b><Icon name="llm" />AI tutor</b>
              <small>helping with {ctx.label}</small>
            </div>
            <span>
              {msgs.length > 0 && <button className="task-hintbtn" onClick={() => { abortRef.current?.abort(); setMsgs([]); }}>New chat</button>}
              <button className="icon-btn" aria-label="Close tutor" onClick={() => setOpen(false)}><Icon name="caret" /></button>
            </span>
          </div>

          <div className="tutor-body" ref={bodyRef}>
            {status !== "authenticated" ? (
              <div className="tutor-empty">
                <p><b>The AI tutor explains anything on this site in plain English</b> — concepts, commands, quiz answers — and gives hints in the labs without spoiling them.</p>
                <p><Link href="/login">Sign in</Link> or <Link href="/register">create a handle</Link> to use it.</p>
              </div>
            ) : msgs.length === 0 ? (
              <div className="tutor-empty">
                <p>Ask me anything about {ctx.label}. I explain in plain English, and in the labs I give hints rather than answers.</p>
                <div className="tutor-sugg">
                  {suggestions.map((s) => <button key={s} className="chip cmd-chip" onClick={() => send({ kind: "chat", text: s }, s)}>{s}</button>)}
                </div>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`tmsg ${m.role}${m.error ? " err" : ""}`}>
                  {m.role === "user" ? <div className="tmsg-bubble">{m.content}</div> : m.content ? <Markdown text={m.content} /> : <span className="tutor-typing" aria-label="Thinking"><i /><i /><i /></span>}
                </div>
              ))
            )}
          </div>

          {status === "authenticated" && (
            <div className="tutor-foot">
              <div className="tutor-input">
                <textarea
                  value={input}
                  rows={2}
                  placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
                  aria-label="Message the tutor"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  maxLength={2000}
                />
                {busy ? (
                  <button className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>
                ) : (
                  <button className="btn primary" onClick={submit} disabled={!input.trim()}>Send</button>
                )}
              </div>
              <small>AI answers can be wrong — double-check important things. Don&apos;t paste passwords or private data.</small>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
