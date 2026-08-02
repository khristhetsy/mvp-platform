"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Demo-booking dialog (spec §5 Step 7). Opens on the `icapos:open-demo` window
 * event (dispatched by CTAs / the assistant). Posts to /api/demo, which records
 * the request and returns a confirmation + .ics the visitor can add to their
 * calendar. Submitting a form + downloading a file are user-initiated here.
 */

type Role = "founder" | "investor";

function defaultSlot(): string {
  // Next weekday at 10:00 local, formatted for <input type="datetime-local">.
  const d = new Date();
  d.setDate(d.getDate() + (d.getDay() === 5 ? 3 : d.getDay() === 6 ? 2 : 1));
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DemoDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("founder");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; ics: string } | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openHandler = () => { setOpen(true); setDone(null); setError(null); };
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

  if (!open) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement)?.value ?? "";
    const local = get("when");
    const payload = {
      role,
      name: get("name").trim(),
      email: get("email").trim(),
      company: get("company").trim() || undefined,
      topic: get("topic").trim() || undefined,
      requested_at: local ? new Date(local).toISOString() : new Date().toISOString(),
      duration_minutes: 30,
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
    a.download = "icapos-demo.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <div className="absolute inset-0 bg-site-navy/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-site-line bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-site-navy px-5 py-4 text-white">
          <h2 id="demo-title" className="font-site-display text-base font-bold">Book a 30-minute demo</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-white/70 hover:text-white">✕</button>
        </div>

        {done ? (
          <div className="p-6 text-center" role="status" aria-live="polite">
            <p className="text-sm leading-6 text-site-ink">{done.message}</p>
            <button type="button" onClick={downloadIcs} className="mt-5 rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">Add to calendar (.ics)</button>
            <button type="button" onClick={() => setOpen(false)} className="mt-2 block w-full text-[13px] text-site-muted hover:text-site-ink">Done</button>
            <p className="mt-4 font-site-mono text-[10px] leading-4 text-site-muted/70">A demo is a walkthrough of the platform. Nothing is offered or sold on this call.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 p-5">
            <div className="flex gap-2" role="radiogroup" aria-label="I am a">
              {(["founder", "investor"] as Role[]).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${role === r ? "border-site-blue bg-site-blue-pale text-site-blue" : "border-site-line text-site-ink hover:border-site-blue-hi"}`}>{r}</button>
              ))}
            </div>
            <Field ref={firstFieldRef} name="name" label="Name" required />
            <Field name="email" label="Work email" type="email" required />
            <Field name="company" label="Company (optional)" />
            <label className="block text-[13px] text-site-muted">Preferred time
              <input name="when" type="datetime-local" required defaultValue={defaultSlot()} className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi" />
            </label>
            <label className="block text-[13px] text-site-muted">What would you like to cover? (optional)
              <textarea name="topic" rows={2} maxLength={500} className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi" />
            </label>
            {error ? <p className="rounded-lg bg-site-amber/10 px-3 py-2 text-[13px] text-site-amber" role="status">{error}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">{busy ? "Requesting…" : "Request demo"}</button>
            <p className="font-site-mono text-[10px] leading-4 text-site-muted/70">We&apos;ll confirm by email. This records a request — it does not place anything on your calendar automatically.</p>
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
