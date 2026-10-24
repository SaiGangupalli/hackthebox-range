"use client";
import { Icon } from "./icons";
import { askTutor } from "@/lib/tutor";

// "Explain" next to a command: asks the AI tutor for a plain-English breakdown.
export function ExplainButton({ command }: { command: string }) {
  return (
    <button className="explain-btn no-print" onClick={() => askTutor({ kind: "explain-command", command }, `Explain this command: ${command}`)} title="Ask the AI tutor to explain this command">
      <Icon name="llm" />Explain
    </button>
  );
}
