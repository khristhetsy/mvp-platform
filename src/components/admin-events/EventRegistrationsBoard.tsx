"use client";

import { useMemo, useState } from "react";
import type { EventRegistrationRow } from "@/lib/icfo-events/registrations";

const TYPE_LABEL: Record<string, string> = {
  investor: "Investor",
  founder: "Founder",
  service: "Service Provider",
  sponsor: "Sponsor",
};
const TYPE_KEYS = ["investor", "founder", "service", "sponsor"] as const;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function answerEntries(answers: Record<string, unknown>): [string, string][] {
  return Object.entries(answers)
    .filter(([k]) => !["company", "name", "email", "phone"].includes(k))
    .map(([k, v]) => [k.replace(/_/g, " "), Array.isArray(v) ? v.join(", ") : String(v ?? "")] as [string, string])
    .filter(([, v]) => v.trim() !== "");
}

export function EventRegistrationsBoard({ eventId, initial }: { eventId: string; initial: EventRegistrationRow[] }) {
  const [rows, setRows] = useState<EventRegistrationRow[]>(initial);
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", company: "" });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) if (r.attendeeType) c[r.attendeeType] = (c[r.attendeeType] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.attendeeType === filter);

  function startEdit(r: EventRegistrationRow) {
    setEditId(r.id);
    setEditForm({ name: r.contactName ?? "", email: r.contactEmail ?? "", phone: r.contactPhone ?? "", company: r.company ?? "" });
    setError(null);
  }
  async function saveContact(regId: string) {
    setBusy(regId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: editForm.name.trim() || null,
          contactEmail: editForm.email.trim() || null,
          contactPhone: editForm.phone.trim() || null,
          company: editForm.company.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Update failed.");
      setRows((rs) => rs.map((r) => (r.id === regId ? (json.registration as EventRegistrationRow) : r)));
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="font-semibold text-[var(--navy)]">Registrations</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Everyone who registered for this event, across all attendee types.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", ...TYPE_KEYS] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === k ? "bg-[var(--navy)] text-white" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {k === "all" ? "All" : TYPE_LABEL[k]} · {counts[k] ?? 0}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">No registrations in this view yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((r) => {
            const entries = answerEntries(r.answers);
            return (
              <div key={r.id} className="rounded-lg border border-[var(--border-subtle)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--navy)]">{r.contactName || r.company || "Unnamed"}</span>
                      {r.attendeeType && (
                        <span className="rounded bg-[var(--indigo-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--indigo)]">
                          {TYPE_LABEL[r.attendeeType] ?? r.attendeeType}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {r.company && <>{r.company} · </>}
                      {r.contactEmail && <>{r.contactEmail}</>}
                      {r.contactPhone && <> · {r.contactPhone}</>} · Registered {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.contactEmail && (
                      <a href={`mailto:${r.contactEmail}`} title="Email" className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--blue)] hover:bg-slate-50"><i className="ti ti-mail" aria-hidden="true" /></a>
                    )}
                    {r.contactPhone && (
                      <a href={`tel:${r.contactPhone.replace(/[^+\d]/g, "")}`} title="Call" className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--blue)] hover:bg-slate-50"><i className="ti ti-phone" aria-hidden="true" /></a>
                    )}
                    <button type="button" onClick={() => (editId === r.id ? setEditId(null) : startEdit(r))} className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50">
                      {editId === r.id ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>

                {editId === r.id && (
                  <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-4">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">Name</span>
                      <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">Email</span>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">Phone</span>
                      <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">Company</span>
                      <input value={editForm.company} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
                    </label>
                    <div className="flex justify-end gap-2 sm:col-span-4">
                      <button type="button" onClick={() => setEditId(null)} disabled={busy === r.id} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
                      <button type="button" onClick={() => saveContact(r.id)} disabled={busy === r.id} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy === r.id ? "Saving…" : "Save"}</button>
                    </div>
                  </div>
                )}

                {entries.length > 0 && (
                  <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {entries.map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <dt className="inline font-medium capitalize text-[var(--text-secondary)]">{k}: </dt>
                        <dd className="inline text-[var(--text-muted)]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
