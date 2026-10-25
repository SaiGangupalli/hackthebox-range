import Link from "next/link";
import { Icon } from "@/components/icons";
import { Flashcards } from "@/components/Flashcards";

export const metadata = { title: "Flashcards · H@ck1h3B0x Range" };

export default function ReviewPage() {
  return (
    <>
      <div className="eyebrow"><Icon name="book" />flashcards</div>
      <h1 className="view-title">Flashcards</h1>
      <p className="lede">
        A few minutes a day keeps what you&apos;ve learned. Cards come from the <Link href="/glossary">glossary</Link> and
        the track quizzes; the ones you know come back less often, the ones you miss come back soon. Progress is saved in
        this browser.
      </p>
      <Flashcards />
    </>
  );
}
