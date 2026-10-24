"use client";
import { Icon } from "../icons";
import { ShellLab } from "./ShellLab";
import { SplLab } from "./SplLab";
import { PacketLab } from "./PacketLab";
import { SqlLab } from "./SqlLab";
import { PromptLab } from "./PromptLab";
import { CryptoLab } from "./CryptoLab";
import { shellLabs } from "@/data/labs/shellLabs";
import { splLabs } from "@/data/labs/splLabs";
import { packetLabs } from "@/data/labs/packetLabs";
import { sqlLabs } from "@/data/labs/sqlLabs";
import { promptLabs } from "@/data/labs/promptLabs";
import { cryptoLabs } from "@/data/labs/cryptoLabs";

// Picks the interactive practice lab(s) for a track. Each engine is added here
// as it comes online; tracks without one yet simply render nothing.
export function PracticeLab({ slug, heading }: { slug: string; heading?: React.ReactNode }) {
  const shell = shellLabs[slug];
  const spl = splLabs[slug];
  const pcap = packetLabs[slug];
  const sql = sqlLabs[slug];
  const prompt = promptLabs[slug];
  const crypto = cryptoLabs[slug];
  if (!shell && !spl && !pcap && !sql && !prompt && !crypto) return null;

  return (
    <>
      {heading ?? <div className="sec-h"><Icon name="zap" />Hands-on practice</div>}
      {pcap && <PacketLab lab={pcap} />}
      {spl && <SplLab lab={spl} />}
      {sql && <SqlLab lab={sql} />}
      {prompt && <PromptLab lab={prompt} />}
      {crypto && <CryptoLab lab={crypto} />}
      {shell && <ShellLab lab={shell} />}
    </>
  );
}
