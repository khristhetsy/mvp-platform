"use client";

import { useState } from "react";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";
import type { EventRegistrationRow } from "@/lib/icfo-events/registrations";
import {
  type RegistrationField,
  REGISTRATION_ROLES,
  REGISTRATION_COMMON,
  REGISTRATION_BY_TYPE,
} from "@/lib/icfo-events/registration-fields";

// Full name is admin-only (self-registration takes the name from the account).
const NAME_FIELD: RegistrationField = { key: "name", label: "Full name", kind: "text", required: true };

export function EventManualRegister({ eventId, onAdded, onClose }: { eventId: string; onAdded: (r: EventRegistrationRow) => void; onClose: () => void }) {
  const [role, setRole] = useState<AttendeeType>("investor");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields: RegistrationField[] = [NAME_FIELD, ...REGISTRATION_COMMON, ...REGISTRATION_BY_TYPE[role]];

  function set(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }
  function toggleChip(key: string, opt: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return { ...a, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  async function submit() {
    const email = String(answers.email ?? "").trim();
    if (!String(answers.name ?? "").trim()) { setError("Enter the guest's full name."); return; }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Enter a valid email address."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeType: role, answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not register the guest.");
      onAdded(json.registration as EventRegistrationRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the guest.");
    } finally {
      setBusy(false);
    }
  }

  function renderField(f: RegistrationField) {
    const label = (
      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">
        {f.label}{f.required ? <span className="text-rose-500"> *</span> : null}
      </span>
    );
    if (f.kind === "checkbox") {
      return (
        <label key={f.key} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] sm:col-span-2">
          <input type="checkbox" checked={Boolean(answers[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
          {f.label}
        </label>
      );
    }
    if (f.kind === "chips") {
      const cur = Array.isArray(answers[f.key]) ? (answers[f.key] as string[]) : [];
      return (
        <div key={f.key} className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] text-[var(--text-secondary)]">{f.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {f.options!.map((o) => (
              <button key={o} type="button" onClick={() => toggleChip(f.key, o)} className={`rounded-full border px-2.5 py-1 text-xs ${cur.includes(o) ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>{o}</button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <label key={f.key} className={`block ${f.kind === "textarea" ? "sm:col-span-2" : ""}`}>
        {label}
        {f.kind === "select" ? (
          <select value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs">
            <option value="">Select…</option>
            {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.kind === "textarea" ? (
          <textarea value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} rows={2} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
        ) : (
          <input type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"} value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
        )}
      </label>
    );
  }

  return (
    <div className="rounded-lg border border-[#bcd3fb] bg-[#f6faff] p-4">
      <div className="mb-3 flex items-center gap-2">
        <i className="ti ti-user-plus text-[var(--blue)]" aria-hidden="true" />
        <span className="text-sm font-medium text-[var(--navy)]">Register a guest manually</span>
        <button type="button" onClick={onClose} className="ml-auto text-xs text-[var(--text-muted)] hover:underline">Cancel</button>
      </div>

      <p className="mb-1.5 text-[11px] text-[var(--text-secondary)]">Registering as</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {REGISTRATION_ROLES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRole(r.key)} className={`rounded-full border px-3 py-1 text-xs ${role === r.key ? "border-[var(--blue)] bg-[var(--indigo-soft)] text-[var(--indigo)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>{r.label}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map(renderField)}
      </div>

      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={busy} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Registering…" : "Register guest"}</button>
      </div>
    </div>
  );
}
