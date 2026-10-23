// Scenario for the SQL-injection teaching lab (src/components/labs/SqlLab.tsx).
// A deliberately vulnerable login, side by side with the parameterized fix, so
// you can see WHY string-built queries break and that one change closes it.
// The toy database and SQL engine live in src/lib/sim/sql.ts.

import type { AutoTask } from "./types";
import type { SqlUser } from "@/lib/sim/sql";

export type SqlLab = {
  id: string;
  title: string;
  intro: string;
  users: SqlUser[];
  samples: { label: string; user: string; pass: string }[];
  tasks: AutoTask[];
};

export const sqlLabs: Record<string, SqlLab> = {
  webmobile: {
    id: "web-sqli",
    title: "Lab · Why string-built SQL breaks",
    intro:
      "This login builds its query by gluing your input into a string — the classic mistake. Try a normal login, then see how a quote in the username changes the query’s meaning. Then flip on the parameterized version and watch the same input stop working. Lab target only.",
    users: [
      { id: 1, username: "admin", password: "S3cure!Adm1n_2026", role: "admin" },
      { id: 2, username: "jordan", password: "Hunter2!", role: "customer" },
      { id: 3, username: "sam", password: "pa55word", role: "customer" },
    ],
    samples: [
      { label: "valid login", user: "jordan", pass: "Hunter2!" },
      { label: "wrong password", user: "jordan", pass: "nope" },
      { label: "comment out the password check", user: "admin' -- ", pass: "anything" },
      { label: "always-true condition", user: "' OR 1=1 -- ", pass: "" },
    ],
    tasks: [
      {
        ask: "Log in with a valid account to see the normal query and result.",
        hint: "Use the “valid login” sample (jordan / Hunter2!) and press Log in. Read the SQL shown above the result.",
        solution: "A normal login returns exactly one row — your own. Notice your input sits inside the quotes of the query string.",
        done: (e) => e.has("login:legit"),
      },
      {
        ask: "Using only the username field, log in as admin WITHOUT knowing the password.",
        hint: "A single quote ends the username string early; -- comments out the rest of the line, including the password check. Try the “comment out the password check” sample.",
        solution: "`admin' -- ` closes the string and comments out ` AND password = '…'`, so the query matches admin with no password. That is SQL injection.",
        done: (e) => e.has("sqli:admin"),
      },
      {
        ask: "Turn on “Parameterized query (the fix)” and run the SAME injection. Confirm it no longer logs you in.",
        hint: "Toggle the fix on, keep the injection in the username, press Log in. The input is now sent as data, not SQL.",
        solution: "Parameterized queries send your input as a value bound to `?`, so quotes can’t change the query’s structure. Same payload, no bypass — this is the fix.",
        done: (e) => e.has("sqli:param-safe"),
      },
    ],
  },
};
