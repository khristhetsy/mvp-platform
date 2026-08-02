"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Contextual page nudge (spec §5, §7). One quiet, dismissible prompt per page,
 * appearing after a delay — never on load, never twice in a session. Text comes
 * from /api/ai task "nudge" (free-text, guardrailed). Sits bottom-LEFT so it
 * never overlaps the assistant FAB. Honours prefers-reduced-motion.
 */

// Per-path context the nudge model reasons over. Utility/auth paths are omitted
// (no entry ⇒ no nudge).
const PAGE_CONTEXT: Record<string, string> = {
  "/": "The visitor is on the iCapOS home page and may be a founder or an investor.",
  "/founders": "The visitor is a founder reading how iCapOS handles readiness, matching and distribution.",
  "/investors": "The visitor is an investor reading about rated deal flow and mandate-based matching.",
  "/readiness": "The visitor is exploring the free Capital Readiness Rating.",
  "/pricing": "The visitor is comparing the two self-serve founder plans.",
  "/events": "The visitor is browsing upcoming iCFO expos and conferences.",
  "/about": "The visitor is reading about iCapOS and iCFO Capital Global.",
};

function contextFor(pathname: string): string | null {
  if (PAGE_CONTEXT[pathname]) return PAGE_CONTEXT[pathname];
  // Prefix match for nested paths (e.g. /founders/...).
  const key = Object.keys(PAGE_CONTEXT).find((k) => k !== "/" && pathname.startsWith(k));
  return key ? PAGE_CONTEXT[key] : null;
}

export function PageNudge() {
  const pathname = usePathname() ?? "/";
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const context = contextFor(pathname);
    if (!context) return;
    const dismissKey = `icapos-nudge:${pathname}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(dismissKey)) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "nudge", messages: [{ role: "user", content: context }] }),
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { ok?: boolean; text?: string } | null;
        if (!cancelled && data?.ok && data.text) {
          setText(data.text);
          setVisible(true);
        }
      } catch {
        /* silent — a nudge is optional */
      }
    }, 9000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [pathname]);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(`icapos-nudge:${pathname}`, "1"); } catch { /* ignore */ }
  }

  if (!visible || !text) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-xs rounded-2xl border border-site-line bg-white p-4 shadow-xl" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <p className="text-[13px] leading-6 text-site-ink">{text}</p>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-site-muted hover:text-site-ink">✕</button>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("icapos:open-assistant")); dismiss(); }} className="rounded-lg bg-site-blue px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-site-blue-hi">Ask a question</button>
        <button type="button" onClick={dismiss} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-site-muted hover:text-site-ink">No thanks</button>
      </div>
      <p className="mt-2 font-site-mono text-[9px] leading-3 text-site-muted/60">Informational only — not advice.</p>
    </div>
  );
}
