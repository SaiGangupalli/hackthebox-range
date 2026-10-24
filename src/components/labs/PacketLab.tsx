"use client";
import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { TaskList } from "./TaskList";
import { compileFilter, transport, type Packet } from "@/lib/sim/packets";
import type { PacketLab as PacketLabData } from "@/data/labs/packetLabs";
import { LabHowTo } from "./LabHowTo";

const COLOR: Record<string, string> = { HTTP: "info", DNS: "warn", TLS: "ok", TCP: "muted", UDP: "muted", ICMP: "muted", FTP: "muted" };

// A Wireshark-style capture reader. Display filters narrow the packet list;
// clicking a row opens a detail pane with the fields and payload. All in-browser.
export function PacketLab({ lab }: { lab: PacketLabData }) {
  const [filter, setFilter] = useState("");
  const [applied, setApplied] = useState("");
  const [sel, setSel] = useState<number | null>(null);

  const compiled = useMemo(() => compileFilter(applied), [applied]);
  const rows = useMemo(() => {
    if (!compiled.ok) return [];
    return lab.packets.map((p, i) => ({ p, n: i + 1 })).filter(({ p, n }) => compiled.match(p, n));
  }, [compiled, lab.packets]);

  const selPkt = sel != null ? lab.packets[sel] : null;

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="network" /><b>{lab.title}</b></div>
        <span className="lab-sim">simulated · {lab.packets.length} packets</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>
      <LabHowTo tool="Type a display filter and press Enter — or click a suggestion — then click a packet to look inside it." />

      <div className="pcap">
        <div className={`pcap-bar${!compiled.ok ? " bad" : applied ? " good" : ""}`}>
          <Icon name="osint" />
          <input
            className="pcap-in"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setApplied(filter); }}
            spellCheck={false}
            autoCapitalize="off"
            aria-label="display filter"
            placeholder='display filter, e.g. http.request.method == "POST"'
          />
          <button className="btn primary" onClick={() => setApplied(filter)}>Apply</button>
          {applied && <button className="btn" onClick={() => { setFilter(""); setApplied(""); }}>Clear</button>}
        </div>
        {!compiled.ok && <div className="pcap-err"><Icon name="shield" /> {compiled.error}</div>}

        <div className="pcap-tips">
          <span>try:</span>
          {lab.starters.map((s) => (
            <button key={s} className="chip cmd-chip" onClick={() => { setFilter(s); setApplied(s); }}>{s}</button>
          ))}
        </div>

        <div className="pcap-table-wrap">
          <table className="pcap-table">
            <thead><tr><th>#</th><th>time</th><th>source</th><th>destination</th><th>proto</th><th>len</th><th>info</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="pcap-none">{compiled.ok ? "No packets match this filter." : "Fix the filter to see packets."}</td></tr>
              ) : rows.map(({ p, n }) => (
                <tr key={n} className={`pcap-row${sel === n - 1 ? " sel" : ""}`} onClick={() => setSel(n - 1)}>
                  <td>{n}</td>
                  <td>{p.t.toFixed(3)}</td>
                  <td>{p.src}</td>
                  <td>{p.dst}</td>
                  <td><span className={`proto ${COLOR[p.proto] ?? "muted"}`}>{p.proto}</span></td>
                  <td>{p.len}</td>
                  <td className="pcap-info">{p.info}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selPkt && <PacketDetail p={selPkt} n={sel! + 1} />}
      </div>

      <TaskList labId={lab.id} tasks={lab.tasks} />
    </div>
  );
}

function PacketDetail({ p, n }: { p: Packet; n: number }) {
  const rows: [string, string][] = [
    ["Frame", `#${n}, ${p.len} bytes, t=${p.t.toFixed(3)}s`],
    ["Transport", `${transport(p)}${p.sport ? `  ${p.src}:${p.sport} → ${p.dst}:${p.dport}` : `  ${p.src} → ${p.dst}`}`],
  ];
  if (p.flags) rows.push(["TCP flags", p.flags]);
  if (p.dns) rows.push(["DNS", `${p.dns.response ? "response" : "query"} ${p.dns.type ?? ""} ${p.dns.qry}${p.dns.answer ? ` → ${p.dns.answer}` : ""}`]);
  if (p.http) rows.push(["HTTP", [p.http.method && `${p.http.method} ${p.http.uri}`, p.http.code && `status ${p.http.code}`, p.http.host && `Host: ${p.http.host}`].filter(Boolean).join("   ")]);
  if (p.tls?.sni) rows.push(["TLS SNI", p.tls.sni]);

  return (
    <div className="pcap-detail">
      <div className="pcap-detail-h">packet #{n} detail</div>
      {rows.map(([k, v]) => (
        <div className="pcap-detail-row" key={k}><span className="pcap-k">{k}</span><span className="pcap-v">{v}</span></div>
      ))}
      {p.payload && (
        <div className="pcap-detail-row">
          <span className="pcap-k">Payload</span>
          <pre className="pcap-payload">{p.payload}</pre>
        </div>
      )}
    </div>
  );
}
