import { Icon } from "@/components/icons";
import { QuizHub } from "@/components/QuizHub";

export const metadata = { title: "Quizzes · H@ck1h3B0x Range" };

export default function QuizPage() {
  return (
    <>
      <div className="eyebrow"><Icon name="trophy" />check what you know</div>
      <h1 className="view-title">Quizzes</h1>
      <p className="lede">
        Every track has a quiz, and the mixed round pulls questions from all of them. Your best score per track is kept
        (and counts toward your XP when you&apos;re signed in).
      </p>
      <QuizHub />
    </>
  );
}
