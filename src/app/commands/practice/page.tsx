import Link from "next/link";
import { Icon } from "@/components/icons";
import { CommandDojo } from "@/components/CommandDojo";

export const metadata = { title: "Command practice · H@ck1h3B0x Range" };

export default function CommandPracticePage() {
  return (
    <>
      <div className="eyebrow"><Icon name="os" />command dojo</div>
      <h1 className="view-title">Command practice</h1>
      <p className="lede">
        Learn the command line by doing. Each drill asks for one small thing; type commands in the practice terminal and
        the drill completes as soon as your command does it. Stuck? Take a hint, see an example, or ask the AI tutor about
        your last command. The <Link href="/commands">command handbook</Link> explains every command used here.
      </p>
      <CommandDojo />
    </>
  );
}
