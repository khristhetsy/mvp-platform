"use client";

// The one stage bar for admin records (Odoo statusbar style): chevron arrows,
// current stage solid blue, done stages gray, later stages light gray,
// separated by thin white chevrons.
// Steps can be buttons (click to move the record), links, or display only.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type StageState = "on" | "done" | "todo";

export type StageStep = {
  key: string;
  label: ReactNode;
  /** Small text after the label, e.g. "3d left". */
  hint?: string;
  /** Overrides the state worked out from `current`. */
  state?: StageState;
  /** Makes the step a link instead of a button. */
  href?: string;
  title?: string;
  /** Extra marker before the label (e.g. an eye icon for the viewed tab). */
  icon?: string;
};

const BLUE = "#185FA5";
const NAVY = "#0A1A40";

const COLORS: Record<StageState, { bg: string; fg: string; weight: number }> = {
  on: { bg: BLUE, fg: "#fff", weight: 600 },
  done: { bg: "#E3E9F1", fg: "#3a4a63", weight: 500 },
  todo: { bg: "#F3F5F8", fg: "#5a6b87", weight: 500 },
};

function clip(first: boolean, notch: number): string {
  return first
    ? `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`
    : `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%, ${notch}px 50%)`;
}

export function OdooStageBar({
  steps,
  current,
  onSelect,
  disabled = false,
  size = "md",
  ariaLabel = "Stage",
  className,
  style,
}: {
  steps: StageStep[];
  /** Key of the current step. Steps before it are done, after it are to do. */
  current?: string | null;
  /** Click handler for button steps. Without it (and without href) steps are display only. */
  onSelect?: (key: string) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const idx = current ? steps.findIndex((s) => s.key === current) : -1;
  const h = size === "sm" ? 26 : size === "lg" ? 34 : 30;
  const font = size === "sm" ? 11 : size === "lg" ? 13 : 12;
  const notch = size === "lg" ? 11 : 9;
  return (
    <div role="group" aria-label={ariaLabel} className={className} style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", minWidth: 0, paddingRight: 1, ...style }}>
      {steps.map((s, i) => {
        const state: StageState = s.state ?? (idx < 0 ? "todo" : i < idx ? "done" : i === idx ? "on" : "todo");
        const c = COLORS[state];
        const first = i === 0;
        const inner: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: h,
          padding: `0 ${notch + 6}px 0 ${first ? 12 : notch + 12}px`,
          fontSize: font,
          fontWeight: c.weight,
          color: c.fg,
          background: c.bg,
          border: "none",
          whiteSpace: "nowrap",
          clipPath: clip(first, notch),
          cursor: s.href || (onSelect && state !== "on" && !disabled) ? "pointer" : "default",
          textDecoration: "none",
          borderRadius: first ? "5px 0 0 5px" : 0,
          fontFamily: "inherit",
        };
        const body = (
          <>
            {s.icon ? <i className={`ti ${s.icon}`} aria-hidden="true" style={{ fontSize: font + 1 }} /> : null}
            {s.label}
            {s.hint ? <span style={{ fontSize: font - 1.5, opacity: 0.8, fontWeight: 400 }}>{s.hint}</span> : null}
          </>
        );
        // Steps overlap by less than the notch, so a thin white chevron separates them (Odoo look).
        const wrap: CSSProperties = { display: "inline-flex", flex: "none", marginLeft: first ? 0 : -(notch - 3) };
        return (
          <span key={s.key} style={wrap}>
            {s.href ? (
              <Link href={s.href} title={s.title} aria-current={state === "on" ? "step" : undefined} style={inner}>{body}</Link>
            ) : onSelect ? (
              <button type="button" title={s.title} aria-current={state === "on" ? "step" : undefined} disabled={disabled || state === "on"} onClick={() => onSelect(s.key)} style={{ ...inner, opacity: disabled && state !== "on" ? 0.7 : 1 }}>{body}</button>
            ) : (
              <span title={s.title} aria-current={state === "on" ? "step" : undefined} style={inner}>{body}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export const STAGE_BAR_NAVY = NAVY;
