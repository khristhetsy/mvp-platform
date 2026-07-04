"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublishItem } from "@/lib/publish/store";
import type { LintFlag } from "@/lib/publish/lint";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A", label: "Draft" },
  lint_flagged: { bg: "#FCEBEB", color: "#A32D2D", label: "Lint flagged" },
  ready: { bg: "#E6F1FB", color: "#185FA5", label: "Ready" },
  scheduled: { bg: "#EEEDFE", color: "#4B3FB5", label: "Scheduled" },
  sent: { bg: "#E1F5EE", color: "#0F6E56", label: "Sent" },
  blocked: { bg: "#FCEBEB", color: "#A32D2D", label: "Blocked" },
};

export function PublishClient({ items, segmentSizes, canApprove }: { items: PublishItem[]; segmentSizes: { hot: number; warm: number; cold: number }; canApprove: boolean }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(items.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveMsg, setApproveMsg] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", subject: "", html: "", text: "", segment: "hot", wave: "1", batch: "1" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          title: form.title,
          subject: form.subject,
          html: form.html,
          text: form.text || null,
          segment: form.segment,
          wave: form.wave,
          batch: Number(form.batch),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setForm({ title: "", subject: "", html: "", text: "", segment: "hot", wave: "1", batch: "1" });
      setShowCreate(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    setBusyId(id); setApproveMsg((m) => ({ ...m, [id]: "" }));
    try {
      const res = await fetch(`/api/publish/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send blocked.");
      setApproveMsg((m) => ({ ...m, [id]: `Sent ${data.sent}, skipped ${data.skipped}, failed ${data.failed}${data.remaining ? ` · ${data.remaining} remaining (approve again)` : " · batch complete"}.` }));
      router.refresh();
    } catch (err) {
      setApproveMsg((m) => ({ ...m, [id]: err instanceof Error ? err.message : "Send blocked." }));
    } finally {
      setBusyId(null);
    }
  }

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2E78F5] focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate((v) => !v)} className="rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white">
          {showCreate ? "Close" : "+ New message"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Internal title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Subject *</label>
              <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Body (HTML) * — use {"{{first_name}}"} / {"{{company}}"}</label>
              <textarea required rows={5} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Segment</label>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className={inputCls}>
                <option value="hot">Hot ({segmentSizes.hot.toLocaleString()})</option>
                <option value="warm">Warm ({segmentSizes.warm.toLocaleString()})</option>
                <option value="cold">Cold ({segmentSizes.cold.toLocaleString()})</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Wave</label>
                <input value={form.wave} onChange={(e) => setForm({ ...form, wave: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Batch (1–3)</label>
                <select value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} className={inputCls}>
                  <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                </select>
              </div>
            </div>
          </div>
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <button type="submit" disabled={saving} className="rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Linting…" : "Create & lint"}
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const st = STATUS_STYLE[it.status] ?? STATUS_STYLE.draft;
              const flags = (it.lint_result as { flags?: LintFlag[] })?.flags ?? [];
              return (
                <li key={it.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-950">{it.title}</p>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {it.channel} · {it.segment ?? "—"} · wave {it.wave ?? "—"} · batch {it.batch ?? "—"}
                      </p>
                      {flags.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {flags.map((f, i) => (
                            <li key={i} className="text-xs text-red-700">✕ {f.rule.replaceAll("_", " ")}: <span className="text-red-600">{f.detail}</span></li>
                          ))}
                        </ul>
                      )}
                      {approveMsg[it.id] ? <p className="mt-1.5 text-xs text-slate-700">{approveMsg[it.id]}</p> : null}
                    </div>
                    <div className="shrink-0">
                      {it.status === "ready" && canApprove ? (
                        <button onClick={() => approve(it.id)} disabled={busyId === it.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                          {busyId === it.id ? "Sending…" : "Approve & send"}
                        </button>
                      ) : it.status === "lint_flagged" ? (
                        <span className="text-xs font-medium text-red-700">Cannot send</span>
                      ) : it.status === "sent" ? (
                        <span className="text-xs font-medium text-emerald-700">Sent</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Firewall: a message only sends when an admin clicks Approve. Lint-flagged copy can never send. Batch N+1 is blocked until batch N clears 97% deliverability.
      </p>
    </div>
  );
}
