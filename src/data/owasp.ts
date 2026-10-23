// Inline code is wrapped in `backticks`; the InlineCode renderer turns those
// segments into <code> elements (React escapes the text, so payloads are inert).
export type Example = {
  bad: string; // the vulnerable code / request
  good: string; // the fixed version
  note?: string; // one line tying it together
};
export type Risk = {
  c: string;
  n: string;
  how: string;
  test: string;
  fix: string;
  example?: Example; // concrete vulnerable → fixed
  lab?: "sqli" | "prompt"; // an embedded live lab session, if one fits
};

export const owasp: Risk[] = [
  { c: "A01", n: "Broken Access Control",
    how: "Users act outside intended permissions — viewing or changing records that are not theirs (IDOR), forced browsing to admin pages, or tampering with roles.",
    test: "Change an `id` in a URL or API body to another user's; replay a privileged request as a low-priv user; remove a role claim from a token.",
    fix: "Deny by default; enforce authorization server-side on every object; use opaque references; log access-control failures.",
    example: {
      bad: "GET /api/invoices/1003\n// returns the invoice to anyone logged in",
      good: "const inv = await db.invoice(id);\nif (inv.userId !== session.userId) return res.status(403);",
      note: "Changing 1003 → 1004 shows another customer’s invoice until you check ownership on every object.",
    },
  },
  { c: "A02", n: "Cryptographic Failures",
    how: "Sensitive data exposed through weak or missing crypto — plaintext transport, weak hashes, hardcoded keys, no encryption at rest.",
    test: "Check for HTTP vs HTTPS, weak TLS, unsalted/MD5 password hashes, secrets in source or responses.",
    fix: "TLS everywhere; argon2/bcrypt for passwords; authenticated encryption; keys in a KMS, never in code.",
    example: {
      bad: "db.save({ pw: md5(password) })        // fast, unsalted, crackable",
      good: "db.save({ pw: await bcrypt.hash(password, 12) })",
      note: "MD5 is a fast, unsalted digest — a GPU cracks a leaked dump in minutes. A slow, salted hash makes that impractical.",
    },
  },
  { c: "A03", n: "Injection",
    how: "Untrusted input is interpreted as a command — SQL, NoSQL, OS command, LDAP. Classic SQLi and XSS live here.",
    test: "Probe inputs with `' OR 1=1--`, `; id`, or `<img src=x onerror=alert(1)>` on lab targets.",
    fix: "Parameterized queries / prepared statements; validate & allow-list input; encode output; least-privilege DB accounts.",
    example: {
      bad: "\"SELECT * FROM users WHERE name='\" + name + \"'\"",
      good: "db.query(\"SELECT * FROM users WHERE name = ?\", [name])",
      note: "In the fixed version the input is bound as a value, so a quote in it can’t change the query. Try it in the lab below.",
    },
    lab: "sqli",
  },
  { c: "A04", n: "Insecure Design",
    how: "Flaws baked into the architecture — missing rate limits, weak recovery flows, trust assumptions that cannot be patched away later.",
    test: "Threat-model the feature; look for missing abuse controls, business-logic bypasses, and over-trust of the client.",
    fix: "Threat model early; secure design patterns; abuse-case tests; defense in depth per feature.",
    example: {
      bad: "// password reset: email a 4-digit code, no rate limit\n// → 10,000 guesses brute-forces it",
      good: "// 256-bit random token, single-use, 15-min expiry, rate-limited",
      note: "No code change fixes a design that allows 10,000 guesses — the control has to exist by design.",
    },
  },
  { c: "A05", n: "Security Misconfiguration",
    how: "Default creds, verbose errors, open cloud buckets, unnecessary features enabled, missing security headers.",
    test: "Check default accounts, directory listing, stack traces, missing `CSP`/`HSTS`, exposed admin panels.",
    fix: "Hardened baselines; disable defaults & unused features; automate config review; set security headers.",
    example: {
      bad: "app.use(errorHandler({ stack: true }))  // leaks paths & versions\n// admin / admin still enabled",
      good: "if (prod) app.use(genericErrorHandler)\nres.setHeader('Content-Security-Policy', \"default-src 'self'\")",
      note: "A stack trace in a 500 response hands an attacker your framework, versions and file paths for free.",
    },
  },
  { c: "A06", n: "Vulnerable & Outdated Components",
    how: "Known-vulnerable libraries, frameworks or runtimes shipped without patching (think Log4Shell).",
    test: "Inventory dependencies; run SCA; match versions against CVE feeds.",
    fix: "SBOM + SCA in CI; patch cadence; remove unused deps; subscribe to advisories.",
    example: {
      bad: "\"dependencies\": { \"lodash\": \"4.17.4\" }  // CVE-2019-10744",
      good: "npm audit --production   # in CI; fail the build on known CVEs",
      note: "You don’t have to write the bug — shipping a library with a public CVE is enough.",
    },
  },
  { c: "A07", n: "Identification & Authentication Failures",
    how: "Weak passwords, credential stuffing, broken session handling, missing MFA, predictable tokens.",
    test: "Try common creds, test lockout, inspect session cookie flags & token entropy, check for session fixation.",
    fix: "MFA; strong password policy + breach checks; secure, rotating session tokens; rate limit & lockout.",
    example: {
      bad: "Set-Cookie: sid=1042            // guessable, no flags",
      good: "Set-Cookie: sid=<128-bit random>; HttpOnly; Secure; SameSite=Lax",
      note: "A sequential or flag-less session id can be guessed or stolen by script; random + HttpOnly + Secure closes that.",
    },
  },
  { c: "A08", n: "Software & Data Integrity Failures",
    how: "Unsigned updates, untrusted CI/CD or plugins, insecure deserialization — code or data trusted without verification.",
    test: "Look for unsigned update channels, deserialization of user data, dependency confusion opportunities.",
    fix: "Sign & verify artifacts; lock CI/CD supply chain; avoid native deserialization of untrusted input.",
    example: {
      bad: "pickle.loads(request.body)      # runs attacker-chosen code",
      good: "data = json.loads(request.body)  # data only, no code paths",
      note: "Native deserialization (pickle, Java readObject) can construct objects that execute code — parse data as data.",
    },
  },
  { c: "A09", n: "Security Logging & Monitoring Failures",
    how: "Attacks go unseen — no logs, no alerts, logs that can be tampered with, so breaches dwell for months.",
    test: "Trigger auth failures & high-value actions; confirm they are logged, alerted, and tamper-resistant.",
    fix: "Log security events centrally; alert on them; protect log integrity; test detection & response.",
    example: {
      bad: "try { login() } catch (e) { /* swallowed */ }",
      good: "logger.warn('auth.failure', { user, ip }); // central, alert at N/min",
      note: "If failed logins are never recorded, a brute force runs for months unseen. (See the Splunk track to hunt these.)",
    },
  },
  { c: "A10", n: "Server-Side Request Forgery (SSRF)",
    how: "The server is tricked into making requests to internal resources — cloud metadata, internal services — on the attacker's behalf.",
    test: "Supply URLs pointing at `169.254.169.254` or internal hosts to any server-side fetch (lab only).",
    fix: "Allow-list outbound destinations; block internal ranges & metadata IPs; validate & canonicalize URLs.",
    example: {
      bad: "fetch(req.query.url)            // url=http://169.254.169.254/… leaks cloud creds",
      good: "if (!ALLOWED_HOSTS.has(new URL(url).hostname)) return res.status(400)",
      note: "A ‘fetch this URL’ feature becomes a window into the cloud metadata service unless the destination is allow-listed.",
    },
  },
];
