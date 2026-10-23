"use client";
import { copyText } from "@/lib/toast";

// A code chip that copies its text on click (used throughout the cheatsheets).
export function Copyable({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={`cmd ${className ?? ""}`}
      role="button"
      tabIndex={0}
      onClick={() => copyText(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copyText(text);
        }
      }}
    >
      {text}
    </span>
  );
}
