import { promptLibrary } from "@/data/prompts";
import { Icon } from "@/components/icons";
import { Copyable } from "@/components/Copyable";

export const metadata = { title: "AI prompts · H@ck1h3B0x Range" };

export default function PromptsPage() {
  return (
    <>
      <div className="eyebrow">// prompt library</div>
      <h1 className="view-title">AI prompts</h1>
      <p className="lede">
        Ready-to-use prompts for any AI assistant (Claude, ChatGPT…): help to identify, decode, analyse, review
        and learn across the CTF categories, plus prompt-injection patterns for the GenAI challenges. Click a prompt
        to copy it, then replace the <code>&lt;…&gt;</code> markers with your own data.
      </p>
      <div className="callout warn" style={{ marginBottom: 6 }}>
        <Icon name="ethics" />
        <div>
          The GenAI injection prompts are for LLM challenges and apps you <b>own or are authorized to test</b> (e.g. the
          GenAI track, or <a href="https://gandalf.lakera.ai" target="_blank" rel="noopener noreferrer">Lakera Gandalf</a>).
          They&apos;re also the attacks the <a href="/tracks/genai">GenAI</a> and AISecOps tracks teach you to defend against.
        </div>
      </div>

      {promptLibrary.map((group) => (
        <div key={group.g}>
          <div className="sec-h"><Icon name={group.warn ? "llm" : "book"} />{group.g}</div>
          <p className="tk-note">{group.note}</p>
          <div className="pl-grid">
            {group.items.map((it) => (
              <div className={`pl-card${group.warn ? " warn" : ""}`} key={it.t}>
                <div className="pl-t">{it.t}</div>
                <Copyable text={it.p} className="pl-prompt" />
                {it.d && <div className="pl-d">{it.d}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="callout info" style={{ marginTop: 20 }}>
        <Icon name="zap" />
        <div>
          Many answers you can get without any AI — the <a href="/tools">Lab tools</a> decode Base64/hex/ROT13/Atbash,
          score CVSS and identify hashes in the browser. And the <b>AI tutor</b> (bottom-right) explains anything on this
          site, with hints in the labs that don&apos;t spoil the answer.
        </div>
      </div>
    </>
  );
}
