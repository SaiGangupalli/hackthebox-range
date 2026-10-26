// A forensics lab built on the shell simulator: "where flags hide." Six places
// a secret turns up in real CTFs and real incidents — document metadata, a
// deleted file, a Jenkins credential store, a browser's saved password, strings
// inside a binary, and a cipher left in a note. Every artefact is a real file
// you read with cat, grep, strings, base64 and tr. All defensive: you're the
// analyst recovering what someone left behind.

import type { ShellSpec } from "@/lib/sim/shell";
import type { ShellLab } from "./shellLabs";

const has = (want: string) => (a: string) => a.trim().toLowerCase().replace(/\s+/g, "").includes(want.toLowerCase().replace(/\s+/g, ""));
const text = (lines: string[]) => lines.join("\n") + "\n";

const CASE = "/cases";

// A small ELF-ish blob with readable strings buried in it, for `strings`.
const widget =
  "\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00>\x00" +
  "/lib64/ld-linux-x86-64.so.2\x00" +
  "libc.so.6\x00GLIBC_2.2.5\x00__cxa_finalize\x00puts\x00" +
  "\x01\x02\x03\x04\x05\x06" +
  "Enter the admin password: \x00" +
  "HHB{str1ngs_sp1ll_s3cr3ts}\x00" +
  "*** stack smashing detected ***\x00";

const forensicsSpec: ShellSpec = {
  user: "analyst", host: "dfir", home: "/home/analyst", cwd: CASE, groups: ["analyst"],
  suggest: [
    "ls -R",
    "cat invoice/docProps/core.xml",
    "cat 'recovery/$Recycle.Bin/$RF8A21.txt'",
    "cat jenkins/credentials.xml",
    "cat firefox/passwords.csv",
    "strings bin/widget | grep HHB",
  ],
  motd: "Case intake. Six artefacts, each hiding a flag the way real evidence does: a document's properties, a deleted file, a Jenkins credential store, a browser's saved password, strings inside a binary, and a ciphered note. Read them with cat, grep, strings, base64 and tr.",
  files: {
    [`${CASE}/README`]: text([
      "DFIR case — find the flag hidden in each artefact (format HHB{...}).",
      "",
      "invoice/     an Office document, already unzipped — its properties are in docProps/core.xml",
      "recovery/    a Windows $Recycle.Bin: $I files hold the original name, $R files hold the data",
      "jenkins/     a Jenkins home: credentials live in credentials.xml, keys in secrets/",
      "firefox/     a browser profile export (and the real logins.json + key4.db)",
      "bin/         a program — the flag is compiled in; pull it out with strings",
      "notes/       a reminder someone 'encoded' before saving",
      "",
      "Tools you have: cat, grep, strings, base64, tr, find, xxd, file.",
    ]),

    // 1. Document metadata — a flag sitting in the properties (as in the CTF photos).
    [`${CASE}/invoice/docProps/core.xml`]: text([
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>",
      "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\">",
      "  <dc:title>Q3 Invoice</dc:title>",
      "  <dc:creator>Tarun Reddy</dc:creator>",
      "  <cp:lastModifiedBy>admin</cp:lastModifiedBy>",
      "  <cp:keywords>confidential, finance</cp:keywords>",
      "  <dc:description>HHB{m3t4d4t4_n3v3r_li3s}</dc:description>",
      "  <cp:revision>8</cp:revision>",
      "  <dcterms:created xsi:type=\"dcterms:W3CDTF\">2025-08-21T12:47:00Z</dcterms:created>",
      "  <dcterms:modified xsi:type=\"dcterms:W3CDTF\">2025-10-09T17:06:00Z</dcterms:modified>",
      "</cp:coreProperties>",
    ]),
    [`${CASE}/invoice/word/document.xml`]: text(["<w:document><w:body><w:p><w:r><w:t>Amount due: ₹48,200</w:t></w:r></w:p></w:body></w:document>"]),

    // 2. Deleted file — the $R file still holds the data.
    [`${CASE}/recovery/$Recycle.Bin/$IF8A21.txt`]: text([
      "# $I index record (metadata only)",
      "OriginalName: C:\\Users\\bob\\Desktop\\old_server_creds.txt",
      "DeletedOn:    2025-10-09 17:06:00",
      "Size:         148 bytes",
    ]),
    [`${CASE}/recovery/$Recycle.Bin/$RF8A21.txt`]: text([
      "old staging box — decommissioned",
      "host: 192.168.1.9  user: deploy",
      "HHB{d3l3t3d_n0t_g0n3}",
      "(delete just unlinks the name; the $R file keeps the bytes until overwritten)",
    ]),

    // 3. Jenkins credential store — encrypted password, but a careless note in <description>.
    [`${CASE}/jenkins/credentials.xml`]: text([
      "<com.cloudbees.plugins.credentials.SystemCredentialsProvider>",
      "  <domainCredentialsMap>",
      "    <entry>",
      "      <com.cloudbees...UsernamePasswordCredentialsImpl>",
      "        <id>tomcat-deploy</id>",
      "        <username>tomcat</username>",
      "        <password>{AQAAABAAAAAQ6q0m2m9x8s1b0b2y3Xk5H8t2Qn==}</password>",
      "        <description>note to self (base64): SEhCe2ozbmsxbnNfY3IzZDV9</description>",
      "      </com.cloudbees...UsernamePasswordCredentialsImpl>",
      "    </entry>",
      "  </domainCredentialsMap>",
      "</com.cloudbees.plugins.credentials.SystemCredentialsProvider>",
    ]),
    [`${CASE}/jenkins/secrets/master.key`]: "b3f1c0a9d7e24f5c8a1b6e3d0f9c2a4b6e8d1f3a5c7b9e0d2f4a6c8e1b3d5f7a9\n",
    [`${CASE}/jenkins/secrets/hudson.util.Secret`]: "\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff (binary key store)\n",

    // 4. Browser saved password — the export has it in the clear.
    [`${CASE}/firefox/passwords.csv`]: text([
      "\"url\",\"username\",\"password\",\"httpRealm\",\"timeCreated\"",
      "\"https://192.168.1.9:8080\",\"tomcat\",\"Wtr_M3l0n!2025\",\"Tomcat Manager\",\"1728492360\"",
    ]),
    [`${CASE}/firefox/logins.json`]: text(["{\"logins\":[{\"hostname\":\"https://192.168.1.9:8080\",\"encryptedUsername\":\"MDIEEPgAAAAAAAAAAAAAAAAAAAEwFAYIKoZIhvcNAwcECM4\",\"encryptedPassword\":\"MEIEEPgAAAAAAAAAAAAAAAAAAAEwFAYIKoZIhvcNAwc...\"}]}"]),
    [`${CASE}/firefox/key4.db`]: "SQLite format 3\x00 (the master key that decrypts logins.json — pair them with firefox_decrypt)\n",

    // 5. Binary with the flag in its strings.
    [`${CASE}/bin/widget`]: widget,

    // 6. A ciphered note (ROT13) in a file.
    [`${CASE}/notes/reminder.txt`]: text([
      "reminder (I rotated it so no one reads it over my shoulder):",
      "UUO{e0g13_1a_n_s1y3}",
      "— decode the old way: tr 'A-Za-z' 'N-ZA-Mn-za-m'",
    ]),
  },
};

export const whereFlagsHideLab: ShellLab = {
  id: "forensics-hiding",
  title: "Lab · Where flags hide",
  intro:
    "Six artefacts from a case, each hiding a flag the way real evidence does — the same patterns as the CTF challenges: a document's properties, a deleted ('rotten') file, a Jenkins credential store, a browser's saved password, strings baked into a binary, and a ciphered note. Read each one, pull out the flag, and learn where to look next time. Everything is a real file; use cat, grep, strings, base64 and tr.",
  spec: forensicsSpec,
  tasks: [
    {
      ask: "The invoice carries a note in its document properties. Read docProps/core.xml — what's the flag?",
      placeholder: "HHB{…}",
      hint: "cat invoice/docProps/core.xml — look at the <dc:description> (and notice who the <dc:creator> is). Office files are zips; their metadata lives in docProps/core.xml.",
      solution: "HHB{m3t4d4t4_n3v3r_li3s} — document properties (author, keywords, description) and image EXIF carry data people forget to strip. Always read the metadata.",
      check: has("HHB{m3t4d4t4_n3v3r_li3s}"),
    },
    {
      ask: "A file was deleted, but the Recycle Bin kept its data. Recover the flag.",
      placeholder: "HHB{…}",
      hint: "In a Windows $Recycle.Bin, the $I file is just the metadata (original name, time) and the $R file is the data. cat 'recovery/$Recycle.Bin/$RF8A21.txt' (quote the path so the shell keeps the $).",
      solution: "HHB{d3l3t3d_n0t_g0n3} — deleting a file unlinks the name; the bytes survive until overwritten. The $R file holds the content, the $I file the original path.",
      check: has("HHB{d3l3t3d_n0t_g0n3}"),
    },
    {
      ask: "Jenkins stores credentials in credentials.xml. The password is encrypted — but someone left a base64 note. Decode it.",
      placeholder: "HHB{…}",
      hint: "cat jenkins/credentials.xml, find the base64 in <description>, then: echo <that> | base64 -d. (The real <password> is {AES}, decryptable only with secrets/master.key + hudson.util.Secret.)",
      solution: "HHB{j3nk1ns_cr3d5} — real Jenkins credentials sit in credentials.xml, encrypted with the keys under secrets/; tools like jenkins-credentials-decryptor reverse that. And base64 is encoding, not encryption — never a safe place for a note.",
      check: has("HHB{j3nk1ns_cr3d5}"),
    },
    {
      ask: "A password for a network service was saved in the browser. What is the password? (format for the full flag is CTF{url:user:password})",
      placeholder: "the password",
      hint: "cat firefox/passwords.csv — the export has it in the clear. (Live, you'd pull logins.json + key4.db and run firefox_decrypt.)",
      solution: "Wtr_M3l0n!2025 — so the flag would be CTF{https://192.168.1.9:8080:tomcat:Wtr_M3l0n!2025}. Browsers store site logins encrypted with a local key (key4.db); anyone with the profile can decrypt them.",
      check: has("Wtr_M3l0n!2025"),
    },
    {
      ask: "The widget program has the flag compiled in. Pull it out of the binary.",
      placeholder: "HHB{…}",
      hint: "strings prints the readable text inside a file: strings bin/widget | grep HHB. (A PE/EXE is the same idea — CFF Explorer or strings over its resources.)",
      solution: "HHB{str1ngs_sp1ll_s3cr3ts} — compiled programs keep literal strings in the clear. strings (or a PE editor like CFF Explorer) reveals hard-coded flags, URLs and keys.",
      check: has("HHB{str1ngs_sp1ll_s3cr3ts}"),
    },
    {
      ask: "The reminder note was 'encoded' before saving. Decode it.",
      placeholder: "HHB{…}",
      hint: "It's ROT13 — rotate each letter 13 places. In the shell: tr 'A-Za-z' 'N-ZA-Mn-za-m' < notes/reminder.txt (or use the /tools decoder).",
      solution: "HHB{r0t13_1n_a_f1l3} — ROT13 is Caesar by 13 and its own inverse. tr swaps the two halves of the alphabet in one pass.",
      check: has("HHB{r0t13_1n_a_f1l3}"),
    },
  ],
};

export const forensicsLabsByTrack: Record<string, ShellLab[]> = {
  forensics: [whereFlagsHideLab],
};
