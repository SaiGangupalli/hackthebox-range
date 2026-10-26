import { createHmac, timingSafeEqual } from "node:crypto";
import type { Question } from "@/data/quiz";

// AI-written questions travel back to the server: the tutor explains them, and
// the next round avoids repeating them or practises the ones you missed.
// Signing them when they're written proves the server wrote them, so a client
// can't slip its own text into a prompt by posing as a question.

const KEY = () => process.env.AUTH_SECRET ?? "";
const body = (q: Question) => JSON.stringify(["hhb-aiq-1", q.q, q.right, q.wrong, q.why, q.snippet ?? ""]);
const mac = (q: Question) => createHmac("sha256", KEY()).update(body(q)).digest("base64url");

export function signQuestion(q: Question): Question {
  return { ...q, sig: mac(q) };
}

/** The question if it's well formed and carries this server's signature, else null. */
export function verifiedQuestion(x: unknown): Question | null {
  if (!KEY() || !x || typeof x !== "object") return null;
  const v = x as Record<string, unknown>;
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : null);
  const wrong = Array.isArray(v.wrong) && v.wrong.every((w) => typeof w === "string") ? (v.wrong as string[]) : null;
  const q = str("q"), right = str("right"), why = str("why"), sig = str("sig");
  if (!q || !right || !why || !sig || !wrong || (v.snippet !== undefined && typeof v.snippet !== "string")) return null;
  const question: Question = { q, right, wrong, why, ...(v.snippet ? { snippet: v.snippet as string } : {}) };
  const want = Buffer.from(mac(question)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? question : null;
}
