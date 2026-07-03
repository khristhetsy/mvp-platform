"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, Globe, Building2, MapPin, Briefcase, Download, Send } from "lucide-react";
import type { ContactFull } from "@/lib/crm/types";

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

function Row({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function RecordView({ record: r }: { record: ContactFull }) {
  const router = useRouter();
  const d = r.details;
  const mailto = d.email
    ? `mailto:${d.email}?subject=${encodeURIComponent(`iCFO — ${r.name}`)}`
    : null;

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
          {mailto && (
            <a href={mailto} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
              <Send className="h-4 w-4" /> Email
            </a>
          )}
          <button onClick={() => exportRecord(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

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
