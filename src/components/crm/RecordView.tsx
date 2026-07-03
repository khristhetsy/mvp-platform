"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, Globe, Building2, MapPin, Briefcase, Download, Send, CalendarPlus, Loader2, Check, Pencil, Archive } from "lucide-react";
import { type ContactFull, type CrmAnnotation, CRM_INTERNAL_STATUSES } from "@/lib/crm/types";
import { ComposeModal } from "@/components/email/ComposeModal";
import type { ComposeDraft } from "@/components/email/types";
import { ScheduleModal } from "@/components/crm/ScheduleModal";
import { EditContactModal } from "@/components/crm/EditContactModal";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

const NAVY = "#0A1A40";
const BLUE = "#2E78F5";

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function exportRecord(r: ContactFull) {
  const rows: [string, string][] = [
    ["Name", r.name],
    ["Type", r.module],
    ["Title", r.details.title ?? ""],
    ["Company", r.details.company ?? ""],
    ["Email", r.details.email ?? ""],
    ["Phone", r.details.phone ?? ""],
    ["Website", r.details.website ?? ""],
    ["Location", r.details.location ?? ""],
    ["Member type", r.details.membership ?? ""],
    ["Lead source", r.details.leadSource ?? ""],
    ["Notes", r.details.description ?? ""],
    ...r.details.profile.map((p) => [p.label, p.values.join("; ")] as [string, string]),
    ...r.rawFields.map((f) => [f.label, f.value] as [string, string]),
  ];
  const csv = "Field,Value\n" + rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${r.name.replace(/[^a-z0-9]+/gi, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function InternalFields({ externalId, initial }: { externalId: string; initial: CrmAnnotation | null }) {
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [status, setStatus] = useState(initial?.status ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => { setDirty(true); setSaved(false); setter(v); };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm/annotations/${encodeURIComponent(externalId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: owner.trim() || null,
          status: status || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not save.");
      setSaved(true);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Internal CRM</h2>
        <span className="text-[10px] text-slate-400">Private to your team · survives Odoo syncs</span>
      </div>
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Owner</span>
          <input value={owner} onChange={(e) => touch(setOwner)(e.target.value)} placeholder="e.g. Khris" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <select value={status} onChange={(e) => touch(setStatus)(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none">
            <option value="">—</option>
            {CRM_INTERNAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-500">Tags (comma-separated)</span>
        <input value={tags} onChange={(e) => touch(setTags)(e.target.value)} placeholder="warm, priority, sector-fit" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-500">Private notes</span>
        <textarea value={notes} onChange={(e) => touch(setNotes)(e.target.value)} rows={3} placeholder="Internal notes on this contact…" className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
      </label>
      <div className="mt-3 flex items-center justify-end gap-2">
        {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> Saved</span>}
        <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
        </button>
      </div>
    </section>
  );
}

function Row({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function RecordView({ record: r, annotation, canWrite = false }: { record: ContactFull; annotation?: CrmAnnotation | null; canWrite?: boolean }) {
  const router = useRouter();
  const d = r.details;

  const [emailOpen, setEmailOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function archive() {
    const ok = await confirmDialog({
      message: `Archive ${r.name} in Odoo? This hides the contact from the CRM and from Odoo's active lists. It's reversible from Odoo.`,
      danger: true,
      confirmLabel: "Archive",
    });
    if (!ok) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(r.externalId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Could not archive.");
      }
      router.push(r.module === "investor" ? "/admin/crm/investors" : r.module === "founder" ? "/admin/crm/founders" : "/admin/crm/unclassified");
    } catch (err) {
      setArchiving(false);
      await confirmDialog({ message: err instanceof Error ? err.message : "Could not archive.", confirmLabel: "OK" });
    }
  }

  async function sendEmail(draft: ComposeDraft) {
    setSending(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/integrations/google/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body, html: draft.html, attachments: draft.attachments }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not send. Is Gmail connected in Settings → Integrations?");
      setEmailOpen(false);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>
            {r.module === "investor" ? "Investor" : r.module === "founder" ? "Founder" : "Unclassified"} · Contact record
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: NAVY }}>{r.name}</h1>
          {r.subtitle && <p className="mt-0.5 text-sm text-slate-500">{r.subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.email && (
            <button onClick={() => { setEmailError(null); setEmailOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
              <Send className="h-4 w-4" /> Email
            </button>
          )}
          <button onClick={() => setScheduleOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <CalendarPlus className="h-4 w-4" /> Schedule
          </button>
          <button onClick={() => exportRecord(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          {canWrite && (
            <>
              <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button onClick={archive} disabled={archiving} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive
              </button>
            </>
          )}
        </div>
      </div>

      {editOpen && <EditContactModal record={r} onClose={() => setEditOpen(false)} />}

      {emailOpen && (
        <ComposeModal
          open={emailOpen}
          title={`Email ${r.name}`}
          sending={sending}
          error={emailError}
          prefill={{ to: d.email ? [d.email] : [], cc: [], subject: "", body: "", mode: "new" }}
          onSend={sendEmail}
          onClose={() => setEmailOpen(false)}
        />
      )}
      {scheduleOpen && (
        <ScheduleModal contactName={r.name} contactEmail={d.email} onClose={() => setScheduleOpen(false)} />
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Contact */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact</h2>
          <div className="space-y-2.5">
            {d.title && <Row icon={Briefcase}>{d.title}</Row>}
            {d.company && <Row icon={Building2}>{d.company}</Row>}
            {d.email && <Row icon={Mail}><a href={`mailto:${d.email}`} className="hover:underline" style={{ color: BLUE }}>{d.email}</a></Row>}
            {d.phone && <Row icon={Phone}>{d.phone}</Row>}
            {d.website && <Row icon={Globe}><a href={d.website.startsWith("http") ? d.website : `https://${d.website}`} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: BLUE }}>{d.website.replace(/^https?:\/\//, "")}</a></Row>}
            {d.location && <Row icon={MapPin}>{d.location}</Row>}
            {!d.title && !d.company && !d.email && !d.phone && !d.website && !d.location && (
              <p className="text-sm text-slate-400">No contact details in Odoo.</p>
            )}
          </div>
          {(d.membership || d.leadSource) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.membership && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{d.membership}</span>}
              {d.leadSource && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">via {d.leadSource}</span>}
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</h2>
          {d.description ? (
            <p className="text-sm leading-relaxed text-slate-700">{d.description}</p>
          ) : (
            <p className="text-sm text-slate-400">No notes in Odoo.</p>
          )}
        </section>
      </div>

      {/* Internal CRM (editable, survives Odoo syncs) */}
      <InternalFields externalId={r.externalId} initial={annotation ?? null} />

      {/* Profile */}
      {d.profile.length > 0 && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {d.profile.map((p, i) => (
              <div key={i}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{p.label}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.values.map((v, j) => (
                    <span key={j} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Other Odoo fields */}
      {r.rawFields.length > 0 && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Other Odoo fields</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {r.rawFields.map((f, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-slate-50 pb-1.5">
                <dt className="text-xs text-slate-400">{f.label}</dt>
                <dd className="text-right text-xs font-medium text-slate-700">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        Source of record is Odoo. Editing and scheduling arrive in later phases. Indicated amounts are non-binding ranges — advisory only, not an offer, solicitation, or placement.
      </p>
    </div>
  );
}
