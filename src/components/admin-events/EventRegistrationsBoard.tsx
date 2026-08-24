"use client";

import { useMemo, useState } from "react";
import type { EventRegistrationRow } from "@/lib/icfo-events/registrations";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";
import {
  type RegistrationField,
  REGISTRATION_COMMON,
  REGISTRATION_BY_TYPE,
} from "@/lib/icfo-events/registration-fields";
import { EventManualRegister } from "./EventManualRegister";

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
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) if (r.attendeeType) c[r.attendeeType] = (c[r.attendeeType] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.attendeeType === filter);
  const selectableEmails = useMemo(() => visible.filter((r) => r.contactEmail && selected.has(r.id)).map((r) => r.contactEmail as string), [visible, selected]);

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((s) => {
      const allIds = visible.map((r) => r.id);
      const allOn = allIds.every((id) => s.has(id));
      return allOn ? new Set() : new Set(allIds);
    });
  }
  function sendBulkEmail() {
    const to = selectableEmails.join(",");
    if (!to) return;
    window.open(`/admin/inbox?compose=1&to=${encodeURIComponent(to)}`, "_blank", "noopener");
  }

  function startEdit(r: EventRegistrationRow) {
    setEditId(r.id);
    setError(null);
  }
  function onSavedRow(updated: EventRegistrationRow) {
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    setEditId(null);
  }
  async function removeRegistration(regId: string) {
    if (!confirm("Remove this registration from the event? This can't be undone — the person's account is not affected.")) return;
    setBusy(regId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/registrations/${regId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Delete failed.");
      }
      setRows((rs) => rs.filter((r) => r.id !== regId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--navy)]">Registrations</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Everyone who registered for this event, across all attendee types.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex overflow-hidden rounded-md border border-[var(--border-subtle)] text-xs">
            <button type="button" onClick={() => setView("cards")} className={`px-2.5 py-1 ${view === "cards" ? "bg-[var(--indigo-soft)] font-medium text-[var(--indigo)]" : "text-[var(--text-secondary)]"}`}>Cards</button>
            <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1 ${view === "list" ? "bg-[var(--indigo-soft)] font-medium text-[var(--indigo)]" : "text-[var(--text-secondary)]"}`}>List</button>
          </span>
          <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            <i className="ti ti-user-plus" aria-hidden="true" /> Register a guest
          </button>
        </div>
      </div>

      {adding && (
        <div className="mt-4">
          <EventManualRegister
            eventId={eventId}
            onClose={() => setAdding(false)}
            onAdded={(r) => { setRows((rs) => [r, ...rs.filter((x) => x.id !== r.id)]); setAdding(false); }}
          />
        </div>
      )}

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

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-[var(--indigo-soft)] px-3 py-2">
          <span className="text-xs font-medium text-[var(--indigo)]">{selected.size} selected</span>
          <button type="button" onClick={sendBulkEmail} disabled={selectableEmails.length === 0} className="ml-auto inline-flex items-center gap-1 rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            <i className="ti ti-mail" aria-hidden="true" /> Send email ({selectableEmails.length})
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-[var(--text-secondary)] hover:underline">Clear</button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">No registrations in this view yet.</p>
      ) : view === "list" ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <div className="grid min-w-[640px] grid-cols-[28px_1.6fr_1fr_1.6fr_90px_96px] items-center gap-2 border-b border-[var(--border-subtle)] bg-slate-50 px-3 py-2 text-[11px] text-[var(--text-muted)]">
            <input type="checkbox" checked={visible.length > 0 && visible.every((r) => selected.has(r.id))} onChange={toggleAll} className="h-3.5 w-3.5" aria-label="Select all" />
            <span>Name</span><span>Type</span><span>Email</span><span>Registered</span><span className="text-right">Actions</span>
          </div>
          {visible.map((r) => (
            <div key={r.id}>
              <div className="grid min-w-[640px] grid-cols-[28px_1.6fr_1fr_1.6fr_90px_96px] items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-xs">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="h-3.5 w-3.5" aria-label="Select registration" />
                <span className="truncate font-medium text-[var(--navy)]">{r.contactName || r.company || "Unnamed"}</span>
                <span className="text-[var(--text-secondary)]">{r.attendeeType ? (TYPE_LABEL[r.attendeeType] ?? r.attendeeType) : "—"}</span>
                <span className="truncate text-[var(--text-muted)]">{r.contactEmail ?? "—"}</span>
                <span className="text-[var(--text-muted)]">{fmtDate(r.createdAt)}</span>
                <span className="flex items-center justify-end gap-2">
                  {r.contactEmail && <a href={`mailto:${r.contactEmail}`} title="Email" className="text-[var(--blue)]"><i className="ti ti-mail" aria-hidden="true" /></a>}
                  <button type="button" onClick={() => (editId === r.id ? setEditId(null) : startEdit(r))} title="Edit" className="text-[var(--text-secondary)]"><i className="ti ti-pencil" aria-hidden="true" /></button>
                  <button type="button" onClick={() => removeRegistration(r.id)} disabled={busy === r.id} title="Delete" className="text-rose-600 disabled:opacity-50"><i className="ti ti-trash" aria-hidden="true" /></button>
                </span>
              </div>
              {editId === r.id && (
                <div className="border-b border-[var(--border-subtle)] px-3 py-3">
                  <RegistrationEditForm eventId={eventId} row={r} onSaved={onSavedRow} onCancel={() => setEditId(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((r) => {
            const entries = answerEntries(r.answers);
            return (
              <div key={r.id} className="rounded-lg border border-[var(--border-subtle)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="mt-1 h-4 w-4" aria-label="Select registration" />
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
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.contactEmail && (
                      <a href={`mailto:${r.contactEmail}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--blue)] hover:bg-slate-50"><i className="ti ti-mail" aria-hidden="true" /> Email</a>
                    )}
                    {r.contactPhone && (
                      <a href={`sms:${r.contactPhone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1 rounded-md border border-[#F4D9A0] bg-[#FAEEDA] px-2 py-1 text-xs text-[#854F0B] hover:opacity-90"><i className="ti ti-message" aria-hidden="true" /> Message</a>
                    )}
                    {r.contactPhone && (
                      <a href={`tel:${r.contactPhone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[#0F6E56] hover:bg-slate-50"><i className="ti ti-phone" aria-hidden="true" /> Call</a>
                    )}
                    <button type="button" onClick={() => (editId === r.id ? setEditId(null) : startEdit(r))} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50"><i className="ti ti-pencil" aria-hidden="true" /> {editId === r.id ? "Close" : "Edit"}</button>
                    <button type="button" onClick={() => removeRegistration(r.id)} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"><i className="ti ti-trash" aria-hidden="true" /> Delete</button>
                  </div>
                </div>

                {editId === r.id && (
                  <RegistrationEditForm eventId={eventId} row={r} onSaved={onSavedRow} onCancel={() => setEditId(null)} />
                )}

                {editId !== r.id && entries.length > 0 && (
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

/** Edit every field of a registration — contact + all type-specific answers. */
function RegistrationEditForm({
  eventId,
  row,
  onSaved,
  onCancel,
}: {
  eventId: string;
  row: EventRegistrationRow;
  onSaved: (r: EventRegistrationRow) => void;
  onCancel: () => void;
}) {
  const type = (row.attendeeType as AttendeeType | null) ?? null;
  const fields: RegistrationField[] = [...REGISTRATION_COMMON, ...(type ? REGISTRATION_BY_TYPE[type] : [])];
  const configKeys = new Set(fields.map((f) => f.key));
  // Legacy answer keys not in the current config (e.g. openToIntros) stay editable.
  const extraKeys = Object.keys(row.answers).filter((k) => !configKeys.has(k) && row.answers[k] != null && row.answers[k] !== "");

  const [answers, setAnswers] = useState<Record<string, unknown>>({ ...row.answers });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }
  function toggleChip(key: string, opt: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return { ...a, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/registrations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Update failed.");
      onSaved(json.registration as EventRegistrationRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  function renderField(f: RegistrationField) {
    const label = (
      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">{f.label}</span>
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
    <div className="mt-3 rounded-md bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map(renderField)}
        {extraKeys.map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[11px] capitalize text-[var(--text-secondary)]">{k.replace(/_/g, " ")}</span>
            <input value={String(answers[k] ?? "")} onChange={(e) => set(k, e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs" />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
        <button type="button" onClick={save} disabled={busy} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
