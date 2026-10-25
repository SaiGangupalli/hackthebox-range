"use client";
import { useEffect, useState } from "react";

const FORMATS = {
  short: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  long: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  time: { hour: "2-digit", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

// A date in the viewer's own locale and timezone. The server knows neither, so
// it renders an empty <time> and the browser fills it in after hydration;
// formatting on both sides gives different text and a hydration error.
export function LocalTime({ at, format = "short" }: { at: string | number; format?: keyof typeof FORMATS }) {
  const [text, setText] = useState("");
  useEffect(() => setText(new Date(at).toLocaleString([], FORMATS[format])), [at, format]);
  return <time dateTime={new Date(at).toISOString()}>{text}</time>;
}
