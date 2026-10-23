import { notFound } from "next/navigation";
import { tracks, trackOrder } from "@/data/tracks";
import { TrackView } from "@/components/TrackView";

export function generateStaticParams() {
  return trackOrder.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = tracks[slug];
  return { title: t ? `${t.title} · H@ck1h3B0x Range` : "H@ck1h3B0x Range" };
}

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!tracks[slug]) notFound();
  return <TrackView slug={slug} />;
}
