"use client";

import type { ReactNode } from "react";

export { Tag, Section } from "@/components/admin/investor-directory/ui";
export { ErrorLine, Field, api, btnCls, dangerCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

/** An on/off switch with a visible label for screen readers. */
export function Toggle({ on, onChange, label, disabled }: Readonly<{ on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }>) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-[18px] w-[34px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[#1A6CE4]" : "bg-slate-300"}`}>
      <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${on ? "right-[2px]" : "left-[2px]"}`} />
    </button>
  );
}

/** A selectable card used for radio style choices. */
export function Choice({ selected, onSelect, title, children, badge }: Readonly<{ selected: boolean; onSelect: () => void; title: string; children?: ReactNode; badge?: ReactNode }>) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3.5 py-3 text-left ${selected ? "border-[#1A6CE4] bg-[#EEF4FF]" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
      <span>
        <span className="text-[13.5px] font-semibold text-slate-900">{title}</span> {badge}
        <span className="mt-0.5 block text-[12.5px] text-slate-500">{children}</span>
      </span>
      <span aria-hidden="true" className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${selected ? "border-[#1A6CE4] bg-[#1A6CE4]" : "border-slate-400"}`} />
    </button>
  );
}
