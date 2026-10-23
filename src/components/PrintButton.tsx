"use client";
import { Icon } from "./icons";

// "Download PDF" via the browser's print-to-PDF. No dependency, and the print
// stylesheet (globals.css @media print) reformats the page into a clean
// black-on-white document. The saved file is named after the page <title>.
export function PrintButton({ className = "btn primary" }: { className?: string }) {
  return (
    <button className={className} onClick={() => window.print()}>
      <Icon name="resources" />
      Download PDF
    </button>
  );
}
