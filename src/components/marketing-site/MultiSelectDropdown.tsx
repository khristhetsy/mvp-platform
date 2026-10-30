"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Multi select dropdown with search and checkboxes. Selected values show as
 * removable tags under the trigger. Closes on outside click and Escape.
 */
export function MultiSelectDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select",
  searchPlaceholder = "Search",
}: Readonly<{
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  function toggle(o: string) {
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  }

  const summary = value.length === 0 ? placeholder : value.length === 1 ? "1 selected" : `${value.length} selected`;

  return (
    <div ref={rootRef} className="relative">
      <span className="text-[13px] font-medium text-site-navy">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`mt-1 flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-left text-sm text-site-ink outline-none ${open ? "border-site-blue-hi" : "border-site-line"}`}
      >
        <span className={value.length === 0 ? "text-site-muted" : ""}>{summary}</span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open ? (
        <div id={panelId} className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-site-line bg-white shadow-xl">
          <div className="border-b border-site-line p-2">
            <input
              type="text"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-site-line px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {shown.length === 0 ? <p className="px-2 py-3 text-[13px] text-site-muted">No matches</p> : null}
            {shown.map((o) => {
              const on = value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(o)}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm text-site-ink hover:bg-slate-50 ${on ? "bg-site-blue/5" : ""}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? "border-site-blue bg-site-blue" : "border-slate-400 bg-white"}`} aria-hidden="true">
                    {on ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg> : null}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-site-line px-3 py-2">
            <button type="button" onClick={() => onChange([])} className="text-[13px] font-medium text-site-muted hover:text-site-ink">Clear all</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-site-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-site-blue-hi">Done</button>
          </div>
        </div>
      ) : null}

      {value.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-site-blue/10 py-1 pl-3 pr-1 text-[12.5px] font-medium text-site-blue">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => toggle(v)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-site-blue/20">
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
