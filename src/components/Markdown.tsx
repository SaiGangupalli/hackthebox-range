import React from "react";

// A small, safe Markdown renderer for tutor answers: paragraphs, ### headings,
// bullet and numbered lists, fenced code blocks, `code`, **bold**, *italic* and
// http(s) links. It builds React elements (never innerHTML), so nothing in a
// model's answer can run as HTML.

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<b key={k}>{m[2].slice(2, -2)}</b>);
    else if (m[3]) out.push(<i key={k}>{m[3].slice(1, -1)}</i>);
    else if (m[4]) out.push(<a key={k} href={m[5]} target="_blank" rel="noopener noreferrer">{m[4].slice(1, m[4].indexOf("]"))}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0, b = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of a still-streaming block)
      blocks.push(<pre key={b++}><code>{body.join("\n")}</code></pre>);
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push(<h4 key={b++}>{inline(line.replace(/^#+\s*/, ""), `h${b}`)}</h4>);
      i++;
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={b++}>{items.map((t, k) => <li key={k}>{inline(t, `u${b}${k}`)}</li>)}</ul>);
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={b++}>{items.map((t, k) => <li key={k}>{inline(t, `o${b}${k}`)}</li>)}</ol>);
    } else if (line.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(```|#{1,6}\s|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={b++}>{inline(para.join(" "), `p${b}`)}</p>);
    }
  }
  return <div className="md">{blocks}</div>;
}
