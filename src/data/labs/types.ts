// Shared shape for a practice-lab task: an investigative question you answer by
// using the live tool. The check runs client-side on your typed answer; the
// hint describes the approach and the solution is revealed on request.
export type Task = {
  ask: string;
  placeholder?: string;
  hint: string;
  solution: string;
  check: (answer: string) => boolean;
};

// An objective that completes by *doing* something in the live tool rather than
// typing an answer. The lab accumulates event tags (e.g. "sqli:bypass") as you
// interact, and `done` reports whether this objective's condition is met.
export type AutoTask = {
  ask: string;
  hint: string;
  solution: string;
  done: (events: Set<string>) => boolean;
};
