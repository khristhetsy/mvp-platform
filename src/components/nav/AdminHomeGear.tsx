"use client";

/**
 * The gear on the admin top bar: company-wide Home settings (style, layout, start page).
 * Shown only to super admins; every other user sees nothing here.
 */
import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";
import { ADMIN_HOME_STYLES, DEFAULT_ADMIN_HOME, type AdminHomeSettings } from "@/lib/settings/admin-home-shape";
import { saveAdminHomeSettings, useAdminHomeSettings } from "@/lib/ui/admin-home-settings";

function useIsSuperAdmin(): boolean {
  const [state, setState] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/users/permissions/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { isSuperAdmin?: boolean } | null) => { if (alive) setState(Boolean(d?.isSuperAdmin)); })
      .catch(() => { /* not shown */ });
    return () => { alive = false; };
  }, []);
  return state;
}

function Segment<T extends string>({ value, options, onChange, label }: Readonly<{
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex overflow-hidden rounded-lg border border-slate-300">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`flex-1 px-2 py-1.5 text-[12px] transition-colors ${value === o.value ? "bg-[var(--blue-muted)] font-semibold text-[var(--blue-hover)]" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AdminHomeGear() {
  const isSuperAdmin = useIsSuperAdmin();
  const settings = useAdminHomeSettings(true) ?? DEFAULT_ADMIN_HOME;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!isSuperAdmin) return null;

  const save = async (patch: Partial<AdminHomeSettings>) => {
    setError(null);
    setError(await saveAdminHomeSettings(patch));
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Customize" title="Customize" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${open ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`}>
        <Settings className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div role="dialog" aria-label="Customize for everyone" className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-lg">
          <div className="flex items-center">
            <p className="text-[13px] font-semibold">Customize for everyone</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="ml-auto rounded p-0.5 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Applies to all admin users</p>

          <label htmlFor="admin-home-style" className="mb-1 mt-3 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--blue)]">Home style</label>
          <select id="admin-home-style" value={settings.style} onChange={(e) => void save({ style: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12.5px]">
            {ADMIN_HOME_STYLES.map((name, i) => <option key={name} value={i + 1}>{i + 1}. {name}</option>)}
          </select>

          <p className="mb-1 mt-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--blue)]">Layout</p>
          <Segment label="Layout" value={settings.layout} onChange={(v) => void save({ layout: v })}
            options={[{ value: "top", label: "Top menu" }, { value: "side", label: "Side menu" }]} />

          <p className="mb-1 mt-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--blue)]">Start page after sign in</p>
          <Segment label="Start page after sign in" value={settings.startPage} onChange={(v) => void save({ startPage: v })}
            options={[{ value: "home", label: "Home grid" }, { value: "dashboard", label: "Dashboard" }]} />

          {error ? <p role="alert" className="mt-2 text-[11.5px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
