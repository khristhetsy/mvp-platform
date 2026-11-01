"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

// The same multi-select used in the contact profile editor: selected tags,
// a bordered checkbox list, a Filter box above 8 options, and a count footer.
export function ListMultiSelect({
  options,
  selected,
  onChange,
  disabled,
  ariaLabel,
}: Readonly<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  ariaLabel: string;
}>) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options;
  }, [options, q]);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div role="group" aria-label={ariaLabel}>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {selected.length === 0 && <span className="text-xs text-slate-400">None selected</span>}
        {selected.map((v) => {
          const lbl = options.find((o) => o.value === v)?.label ?? v;
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              {lbl}
              <button type="button" disabled={disabled} onClick={() => toggle(v)} aria-label={`Remove ${lbl}`} className="text-slate-400 hover:text-slate-700">
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {options.length > 8 && (
          <div className="relative border-b border-slate-100">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-full rounded-t-lg py-2 pl-8 pr-2 text-sm outline-none" />
          </div>
        )}
        <div className="max-h-40 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400">No options.</p>
          ) : (
            filtered.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" disabled={disabled} checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="h-4 w-4 rounded border-slate-300" />
                <span className="text-slate-700">{o.label}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && <div className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-400">{selected.length} selected</div>}
      </div>
    </div>
  );
}
