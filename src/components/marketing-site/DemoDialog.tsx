"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Demo-booking dialog (spec §9). Opens on the `icapos:open-demo` event. Fetches
 * server-generated slots (firm timezone, UTC ISO) and renders them in the
 * visitor's local timezone. Role picks the agenda shown before slot selection.
 * On confirm, posts to /api/demo, which records the request, emails a real
 * confirmation with the .ics, and returns the note + .ics for download here.
 */

type Role = "founder" | "investor";

const AGENDAS: Record<Role, { title: string; points: string[] }> = {
  founder: {
    title: "Founder walkthrough",
    points: [
      "Your Capital Readiness Rating and what it surfaces",
      "How matching builds your investor list from mandates",
      "How distribution of your materials works — and the monthly cap",
    ],
  },
  investor: {
    title: "Investor walkthrough",
    points: [
      "Setting a mandate and the volume cap you control",
      "Rated, diligence-ready deal flow in the Private Market",
      "Standardized data rooms and how syndication coordination works",
    ],
  },
};

function groupByLocalDay(slots: string[]): { day: string; items: { iso: string; time: string }[] }[] {
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const map = new Map<string, { iso: string; time: string }[]>();
  for (const iso of slots) {
    const d = new Date(iso);
    const day = dayFmt.format(d);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push({ iso, time: timeFmt.format(d) });
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

export function DemoDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("founder");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; ics: string } | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openHandler = () => { setOpen(true); setDone(null); setError(null); setSelected(null); };
    window.addEventListener("icapos:open-demo", openHandler);
    return () => window.removeEventListener("icapos:open-demo", openHandler);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadSlots() {
      setSlotsLoading(true);
      try {
        const r = await fetch("/api/demo");
        const d = await r.json();
        if (!cancelled) setSlots(Array.isArray(d?.slots) ? d.slots : []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    loadSlots();
    return () => { cancelled = true; };
  }, [open]);

  const grouped = useMemo(() => groupByLocalDay(slots), [slots]);

  if (!open) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) { setError("Please choose a time."); return; }
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement)?.value ?? "";
    const payload = {
      role,
      name: get("name").trim(),
      email: get("email").trim(),
      company: get("company").trim() || undefined,
      topic: get("topic").trim() || undefined,
      requested_at: selected,
      source_page: typeof window !== "undefined" ? window.location.pathname : undefined,
    };
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; ics?: string } | null;
      if (data?.ok && data.message && data.ics) setDone({ message: data.message, ics: data.ics });
      else setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network trouble. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function downloadIcs() {
    if (!done) return;
    const blob = new Blob([done.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "icapos-walkthrough.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <div className="absolute inset-0 bg-site-navy/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-site-line bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-site-navy px-5 py-4 text-white">
          <h2 id="demo-title" className="font-site-display text-base font-bold">Book a 30-minute walkthrough</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-white/70 hover:text-white">✕</button>
        </div>

        {done ? (
          <div className="p-6 text-center" role="status" aria-live="polite">
            <p className="text-sm leading-6 text-site-ink">{done.message}</p>
            <p className="mt-2 text-[13px] text-site-muted">We&apos;ve emailed you a confirmation with a calendar invite.</p>
            <button type="button" onClick={downloadIcs} className="mt-5 rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">Add to calendar (.ics)</button>
            <button type="button" onClick={() => setOpen(false)} className="mt-2 block w-full text-[13px] text-site-muted hover:text-site-ink">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="flex gap-2" role="radiogroup" aria-label="I am a">
              {(["founder", "investor"] as Role[]).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${role === r ? "border-site-blue bg-site-blue-pale text-site-blue" : "border-site-line text-site-ink hover:border-site-blue-hi"}`}>{r}</button>
              ))}
            </div>

            <div className="rounded-xl border border-site-line bg-site-paper p-4">
              <div className="font-site-mono text-[11px] uppercase tracking-wide text-site-muted">{AGENDAS[role].title} — what we&apos;ll cover</div>
              <ul className="mt-2 space-y-1.5">
                {AGENDAS[role].points.map((p) => (<li key={p} className="flex gap-2 text-[13px] leading-5 text-site-ink"><span className="text-site-blue">•</span>{p}</li>))}
              </ul>
            </div>

            <div>
              <div className="text-[13px] font-medium text-site-navy">Pick a time <span className="font-site-mono text-site-muted">(your local timezone)</span></div>
              {slotsLoading ? (
                <p className="mt-2 font-site-mono text-[12px] text-site-muted" role="status">Loading times…</p>
              ) : grouped.length === 0 ? (
                <p className="mt-2 text-[13px] text-site-muted">No times available right now — email us and we&apos;ll arrange one.</p>
              ) : (
                <div className="mt-2 space-y-3">
                  {grouped.map((g) => (
                    <div key={g.day}>
                      <div className="font-site-mono text-[11px] uppercase tracking-wide text-site-muted">{g.day}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {g.items.map((it) => (
                          <button key={it.iso} type="button" onClick={() => setSelected(it.iso)} aria-pressed={selected === it.iso} className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${selected === it.iso ? "border-site-blue bg-site-blue text-white" : "border-site-line text-site-ink hover:border-site-blue-hi hover:text-site-blue-hi"}`}>{it.time}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Field ref={firstFieldRef} name="name" label="Name" required />
            <Field name="email" label="Work email" type="email" required />
            <Field name="company" label="Company (optional)" />
            <label className="block text-[13px] text-site-muted">What would you like to cover? (optional)
              <textarea name="topic" rows={2} maxLength={500} className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi" />
            </label>

            {error ? <p className="rounded-lg bg-site-amber/10 px-3 py-2 text-[13px] text-site-amber" role="status">{error}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">{busy ? "Requesting…" : "Request walkthrough"}</button>
            <p className="font-site-mono text-[10px] leading-4 text-site-muted/70">The walkthrough is optional — everything on iCapOS is self-serve without one. We&apos;ll confirm by email.</p>
          </form>
        )}
      </div>
    </div>
  );
}

const Field = ({ ref, name, label, type = "text", required = false }: { ref?: React.Ref<HTMLInputElement>; name: string; label: string; type?: string; required?: boolean }) => (
  <label className="block text-[13px] text-site-muted">{label}
    <input ref={ref} name={name} type={type} required={required} autoComplete={name === "email" ? "email" : name === "name" ? "name" : "off"} className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi" />
  </label>
);
