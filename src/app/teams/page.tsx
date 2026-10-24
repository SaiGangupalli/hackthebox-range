import Link from "next/link";
import { Icon } from "@/components/icons";
import { TeamPanel } from "@/components/TeamPanel";

export const metadata = { title: "Teams · H@ck1h3B0x Range" };

export default function TeamsPage() {
  return (
    <>
      <div className="eyebrow"><Icon name="flag" />play together</div>
      <h1 className="view-title">Teams</h1>
      <p className="lede">
        Team up with friends or colleagues. Everyone keeps their own handle and profile; the team also gets a place on
        the <Link href="/scoreboard?view=teams">team scoreboard</Link>.
      </p>
      <ol className="howto" aria-label="How teams work">
        <li><span>1</span><div>One player creates the team and gets a join code.</div></li>
        <li><span>2</span><div>Teammates sign in and join with that code (up to 4 per team).</div></li>
        <li><span>3</span><div>Each challenge counts once for the team, at the first solve by any member. Paid hints any member opens come off the team score.</div></li>
      </ol>
      <TeamPanel />
    </>
  );
}
