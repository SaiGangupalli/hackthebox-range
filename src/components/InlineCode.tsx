import React from "react";

// Renders a string where `backtick`-wrapped spans become <code>. React escapes
// the text, so example payloads render literally and never execute.
export function InlineCode({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <code key={i}>{part}</code> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}
