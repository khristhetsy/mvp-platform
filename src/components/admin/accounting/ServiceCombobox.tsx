"use client";

/**
 * Invoice line Description: type freely or pick a saved service, which fills
 * the description and its default price. "Save as a new service" adds what was
 * typed (with the line's price) to Accounting › Settings › Services.
 */
import { useEffect, useId, useRef, useState } from "react";
import { money, servicesFor, type Service } from "@/lib/accounting/core";
import { inputCls } from "@/components/admin/accounting/ui";

export function ServiceCombobox({
  value, entity, services, onChange, onPick, onSaveNew,
}: Readonly<{
  value: string;
  entity: string;
  services: Service[];
  onChange: (description: string) => void;
  onPick: (service: Service) => void;
  /** Saves the typed text as a service; resolves to an error message, or null when saved. */
  onSaveNew: (name: string) => Promise<string | null>;
}>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = servicesFor(services, entity, value).slice(0, 8);
  const typed = value.trim();
  const exact = services.some((s) => s.name.toLowerCase() === typed.toLowerCase());
  const options: Array<{ kind: "service"; s: Service } | { kind: "typed" } | { kind: "save" }> = [
    ...matches.map((s) => ({ kind: "service" as const, s })),
    ...(typed && !exact ? [{ kind: "typed" as const }, { kind: "save" as const }] : []),
  ];

  useEffect(() => {
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  async function choose(i: number) {
    const o = options[i];
    if (!o) return;
    if (o.kind === "service") { onPick(o.s); setOpen(false); return; }
    if (o.kind === "typed") { setOpen(false); return; }
    setSaving(true);
    const err = await onSaveNew(typed);
    setSaving(false);
    setNote(err ?? `Saved "${typed}" to Services.`);
    if (!err) setOpen(false);
  }

  function key(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && options.length) { e.preventDefault(); void choose(active); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className={`${inputCls} pr-7`}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); setNote(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={key}
          placeholder={services.length ? "Pick a service or type" : "Advisory services"}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <button type="button" tabIndex={-1} aria-label="Show services" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => setOpen((o) => !o)}>
          <i className="ti ti-chevron-down" aria-hidden="true" />
        </button>
      </div>
      {open && options.length > 0 ? (
        <div id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-lg border border-slate-200 bg-white text-[13px] shadow-lg">
          {options.map((o, i) => {
            const on = i === active ? "bg-[#E6F1FB]" : "hover:bg-slate-50";
            if (o.kind === "service") {
              return (
                <button key={o.s.id} type="button" role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => void choose(i)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2 text-left ${on}`}>
                  <span className="text-slate-900">{o.s.name}</span>
                  <span className="shrink-0 text-[12px] text-slate-500">{o.s.unit_cents == null ? "No default price" : money(o.s.unit_cents)}</span>
                </button>
              );
            }
            return (
              <button key={o.kind} type="button" role="option" aria-selected={i === active} disabled={saving} onMouseEnter={() => setActive(i)} onClick={() => void choose(i)}
                className={`flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-[#1A6CE4] ${on}`}>
                <i className={`ti ${o.kind === "typed" ? "ti-plus" : "ti-bookmark-plus"}`} aria-hidden="true" />
                {o.kind === "typed" ? `Use "${typed}" as typed` : saving ? "Saving…" : `Save "${typed}" as a new service`}
              </button>
            );
          })}
        </div>
      ) : null}
      {note ? <p className="mt-1 text-[11.5px] text-slate-500">{note}</p> : null}
    </div>
  );
}
