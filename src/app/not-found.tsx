import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <>
      <div className="eyebrow">// 404</div>
      <h1 className="view-title">Flag not found</h1>
      <p className="lede">That page isn&apos;t part of the range. Head back to base.</p>
      <Link className="btn primary" href="/"><Icon name="shield" />Home</Link>
    </>
  );
}
