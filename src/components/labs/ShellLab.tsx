"use client";
import { useMemo } from "react";
import { Icon } from "../icons";
import { TaskList } from "./TaskList";
import { Terminal } from "./Terminal";
import { Shell } from "@/lib/sim/shell";
import type { ShellLab as ShellLabData } from "@/data/labs/shellLabs";
import { LabHowTo } from "./LabHowTo";

// A terminal lab: the simulated shell plus the lab's objectives.
export function ShellLab({ lab }: { lab: ShellLabData }) {
  const shell = useMemo(() => new Shell(lab.spec), [lab]);

  return (
    <div className="plab">
      <div className="lab-head">
        <div><Icon name="os" /><b>{lab.title}</b></div>
        <span className="lab-sim">simulated · in-browser</span>
      </div>
      <p className="lab-intro">{lab.intro}</p>
      <LabHowTo tool="Type a command in the terminal and press Enter — or click a grey suggestion to fill one in. Type help to list commands." />
      <Terminal shell={shell} motd={lab.spec.motd} suggest={lab.spec.suggest} />
      <TaskList labId={lab.id} tasks={lab.tasks} />
    </div>
  );
}
