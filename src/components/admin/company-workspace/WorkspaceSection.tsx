"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// Option-1 section header used across the company workspace: a Tabler icon + title
// + one-line hint, with a color-coded underline per tone so staff can scan the page
// by group. Each section is collapsible — clicking the header folds its content; the
// open/closed choice is remembered per browser (keyed by title). Same layout
// contract as PageSection, plus icon + tone + collapse.

type Tone = "blue" | "purple" | "amber" | "gray" | "red" | "teal" | "green";

const TONES: Record<Tone, { icon: string; line: string }> = {
  blue: { icon: "#185FA5", line: "#B5D4F4" },
  purple: { icon: "#534AB7", line: "#CECBF6" },
  amber: { icon: "#BA7517", line: "#FAC775" },
  gray: { icon: "#5F5E5A", line: "#D3D1C7" },
  red: { icon: "#A32D2D", line: "#F0C7C7" },
  teal: { icon: "#0F6E56", line: "#9FE1CB" },
  green: { icon: "#3B6D11", line: "#C0DD97" },
};

export function WorkspaceSection({
  icon,
  tone = "blue",
  title,
  subtitle,
  action,
  children,
  className = "",
}: Readonly<{
  icon: string;
  tone?: Tone;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  const c = TONES[tone];
  const storageKey = `cw.section.${title}`;
  // Default open; hydrate the remembered choice after mount to avoid SSR mismatch.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted collapse state after mount
      if (window.localStorage.getItem(storageKey) === "0") setOpen(false);
    } catch { /* ignore */ }
  }, [storageKey]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      try { window.localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <section className={`space-y-4 ${className}`}>
      <header
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className="flex cursor-pointer select-none flex-wrap items-end justify-between gap-3 border-b-2 pb-2"
        style={{ borderColor: c.line }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Clear collapse arrow — tinted the section accent, rotates down when open. */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon}
            strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            className="shrink-0 transition-transform duration-150"
            style={{ transform: open ? "rotate(90deg)" : "none" }}
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <i className={`ti ${icon} text-[18px]`} style={{ color: c.icon }} aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Stop the header toggle when the action (e.g. a link) is clicked. */}
          {action ? <span onClick={(e) => e.stopPropagation()}>{action}</span> : null}
        </div>
      </header>
      {/* Kept mounted when collapsed (display:none) so child state and loads persist. */}
      <div className={open ? "" : "hidden"}>{children}</div>
    </section>
  );
}
