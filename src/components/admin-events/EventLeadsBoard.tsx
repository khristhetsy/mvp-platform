"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventLead, LeadStatus } from "@/lib/icfo-events/leads";

const STATUS_CLS: Record<LeadStatus, string> = {
  open: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-700",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-slate-100 text-slate-500",
};
const STATUS_KEYS: LeadStatus[] = ["open", "contacted", "won", "lost"];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function answerEntries(answers: Record<string, unknown>): [string, string][] {
  return Object.entries(answers)
    .filter(([k]) => !["company", "name", "email", "phone"].includes(k))
    .map(([k, v]) => [k.replace(/_/g, " "), Array.isArray(v) ? v.join(", ") : String(v ?? "")] as [string, string])
    .filter(([, v]) => v.trim() !== "");
}

export function EventLeadsBoard({ eventId, initialLeads }: { eventId: string; initialLeads: EventLead[] }) {
  const t = useTranslations("eventsAdmin.leads");
  const [leads, setLeads] = useState<EventLead[]>(initialLeads);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, open: 0, contacted: 0, won: 0, lost: 0 };
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const visible = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  async function update(lead: EventLead, status: LeadStatus) {
    setBusy(lead.id);
    setError(null);
    const prev = lead.status;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    try {
      const res = await fetch(`/api/admin/events/${eventId}/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed.");
    } catch (err) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(l: EventLead) {
    setEditId(l.id);
    setEditForm({ name: l.contactName ?? "", email: l.contactEmail ?? "", phone: l.contactPhone ?? "" });
    setError(null);
  }
  async function saveContact(leadId: string) {
    setBusy(leadId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: editForm.name.trim() || null,
          contactEmail: editForm.email.trim() || null,
          contactPhone: editForm.phone.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Update failed.");
      setLeads((ls) => ls.map((l) => (l.id === leadId ? (json.lead as EventLead) : l)));
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="font-semibold text-[var(--navy)]">{t("title")}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{t("desc")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "open", "contacted", "won", "lost"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === k ? "bg-[var(--navy)] text-white" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {t(k)} · {counts[k] ?? 0}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">{t("noLeads")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((l) => {
            const entries = answerEntries(l.answers);
            return (
              <div key={l.id} className="rounded-lg border border-[var(--border-subtle)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--navy)]">{l.company || l.contactName || t("unnamed")}</span>
                      <span className="rounded bg-[var(--indigo-soft)] px-1.5 py-0.5 text-xs font-medium capitalize text-[var(--indigo)]">{l.leadType}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {l.contactName ?? "—"}
                      {l.contactEmail && <> · {l.contactEmail}</>}
                      {l.contactPhone && <> · {l.contactPhone}</>} · {t("registered", { date: fmtDate(l.createdAt) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.contactEmail && (
                      <a href={`mailto:${l.contactEmail}`} title="Email" className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--blue)] hover:bg-slate-50"><i className="ti ti-mail" aria-hidden="true" /></a>
                    )}
                    {l.contactPhone && (
                      <a href={`tel:${l.contactPhone.replace(/[^+\d]/g, "")}`} title="Call" className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--blue)] hover:bg-slate-50"><i className="ti ti-phone" aria-hidden="true" /></a>
                    )}
                    <button type="button" onClick={() => (editId === l.id ? setEditId(null) : startEdit(l))} className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50">
                      {editId === l.id ? "Close" : "Edit"}
                    </button>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[l.status]}`}>
                      {t(l.status)}
                    </span>
                    <select
                      value={l.status}
                      disabled={busy === l.id}
                      onChange={(e) => update(l, e.target.value as LeadStatus)}
                      className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs disabled:opacity-50"
                      aria-label={t("leadStatus")}
                    >
                      {STATUS_KEYS.map((k) => (
                        <option key={k} value={k}>{t(k)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {editId === l.id && (
                  <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-3">
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
                    <div className="flex justify-end gap-2 sm:col-span-3">
                      <button type="button" onClick={() => setEditId(null)} disabled={busy === l.id} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
                      <button type="button" onClick={() => saveContact(l.id)} disabled={busy === l.id} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy === l.id ? "Saving…" : "Save"}</button>
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
