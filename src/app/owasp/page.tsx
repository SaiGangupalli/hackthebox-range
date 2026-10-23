import { OwaspList } from "@/components/OwaspList";
import { owasp } from "@/data/owasp";

export const metadata = { title: "OWASP Web Top 10 · H@ck1h3B0x Range" };

export default function OwaspPage() {
  return (
    <OwaspList
      list={owasp}
      title="OWASP Web Top 10"
      sub="The ten most critical web application security risks (2021). Learn each one by how it is attacked and how it is defended."
      eyebrow="// web application security"
    />
  );
}
