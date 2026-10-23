"use client";

// Minimal global toast via a CustomEvent the Shell listens for.
export function showToast(message: string) {
  try {
    window.dispatchEvent(new CustomEvent("hhb-toast", { detail: message }));
  } catch { /* no window (SSR) */ }
}

export async function copyText(text: string) {
  const t = (text || "").replace(/…/g, "").trim();
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    showToast("copied");
    return;
  } catch { /* fall through to execCommand */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("copied");
  } catch { /* give up silently */ }
}
