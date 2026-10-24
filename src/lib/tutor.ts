"use client";

// Ask the AI tutor from anywhere on the page. The TutorPanel (mounted once in
// the Shell) listens for this event, opens, shows `label` as your message and
// streams the answer. `ask` is what the server turns into a prompt.
export type TutorAsk =
  | { kind: "chat"; text: string }
  | { kind: "explain-command"; command: string }
  | { kind: "nudge"; labId: string; index: number }
  | { kind: "quiz-explain"; question: string; picked: string }
  | { kind: "drill-help"; drillId: string; command?: string; output?: string };

export const TUTOR_EVENT = "hhb-tutor-ask";

export function askTutor(ask: TutorAsk, label: string) {
  try { window.dispatchEvent(new CustomEvent(TUTOR_EVENT, { detail: { ask, label } })); } catch { /* no window */ }
}

export function openTutor() {
  try { window.dispatchEvent(new CustomEvent(TUTOR_EVENT, { detail: null })); } catch { /* no window */ }
}
