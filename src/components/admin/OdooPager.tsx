"use client";

/**
 * Odoo-style pager: "13 / 13" followed by a bordered ‹ › button pair.
 * Used for record navigation (IR task Prev / Next) and list paging (Matching queue).
 * Each side takes either an href (navigates with a Link) or an onClick (runs a handler).
 */
import Link from "next/link";

type Side = { href?: string; onClick?: () => void; disabled?: boolean; title?: string };

const btn = "flex h-[26px] w-7 items-center justify-center text-slate-700 hover:bg-slate-50";
const off = "flex h-[26px] w-7 items-center justify-center text-slate-300";

function PagerButton({ side, label, icon, divider }: { side: Side; label: string; icon: string; divider?: boolean }) {
  const cls = divider ? "border-l border-slate-300" : "";
  const inner = <i className={`ti ${icon}`} aria-hidden="true" />;
  if (side.disabled || (!side.href && !side.onClick)) return <span aria-label={label} aria-disabled="true" className={`${off} ${cls}`}>{inner}</span>;
  if (side.href) return <Link href={side.href} aria-label={label} title={side.title ?? label} className={`${btn} ${cls}`}>{inner}</Link>;
  return <button type="button" onClick={side.onClick} aria-label={label} title={side.title ?? label} className={`${btn} ${cls}`}>{inner}</button>;
}

export function OdooPager({ label, prev, next, className = "" }: { label: string; prev: Side; next: Side; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[12.5px] text-slate-600 ${className}`}>
      <span className="tabular-nums">{label}</span>
      <span className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white">
        <PagerButton side={prev} label="Previous" icon="ti-chevron-left" />
        <PagerButton side={next} label="Next" icon="ti-chevron-right" divider />
      </span>
    </span>
  );
}
