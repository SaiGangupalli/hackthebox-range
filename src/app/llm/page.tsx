import { OwaspList } from "@/components/OwaspList";
import { llm } from "@/data/llm";

export const metadata = { title: "OWASP LLM Top 10 · H@ck1h3B0x Range" };

export default function LlmPage() {
  return (
    <OwaspList
      list={llm}
      title="OWASP LLM Top 10"
      sub="The top risks for applications built on large language models (2025) — this year's focus area."
      eyebrow="// genai security"
    />
  );
}
