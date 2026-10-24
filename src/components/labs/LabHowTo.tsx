// Three short numbered steps shown at the top of every lab, so a first-timer
// knows what to do before touching the tool. `auto` labs tick objectives off
// as you act; the others check an answer you type.
export function LabHowTo({ tool, auto = false }: { tool: string; auto?: boolean }) {
  const steps = [
    "Read the first objective at the bottom of this lab.",
    tool,
    auto ? "Objectives tick themselves off when you do them." : "Type what you found into the objective and press Check.",
  ];
  return (
    <ol className="howto" aria-label="How this lab works">
      {steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}
    </ol>
  );
}
