"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManualInvestor } from "@/lib/founder/manual-investors";

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  angellist: "AngelList",
  intro: "Warm intro",
  event: "Event",
  inbound: "Inbound",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  tracking: "Tracking",
  in_diligence: "In diligence",
  closed: "Closed",
  passed: "Passed",
};

const STATUS_STYLE: Record<string, string> = {
  tracking: "bg-slate-100 text-slate-600",
  in_diligence: "bg-amber-100 text-amber-700",
  closed: "bg-emerald-100 text-emerald-700",
  passed: "bg-slate-100 text-slate-400",
};

export function ManualInvestorsPanel({ investors }: { investors: ManualInvestor[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    firm: "",
    email: "",
    source: "linkedin",
    checkSize: "",
    notes: "",
    invited: false,
  });

  function reset() {
    setForm({ name: "", firm: "", email: "", source: "linkedin", checkSize: "", notes: "", invited: false });
    setError(null);
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("Add the investor's name.");
      return;
    }
    if (form.invited && !form.email.trim()) {
      setError("An email is needed to send an invite. Turn the invite off to just track them.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/manual-investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          firm: form.firm || null,
          email: form.email || null,
          source: form.source,
          checkSize: form.checkSize || null,
          notes: form.notes || null,
          invited: form.invited,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not add the investor.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Investors you&apos;re tracking</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Add investors you sourced yourself — LinkedIn, AngelList, a warm intro. Private to you; no invite required.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <span aria-hidden="true">+</span> Add an interested investor
        </button>
      </div>

      {investors.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">No tracked investors yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Met someone interested off-platform? Add them here to keep the conversation in your pipeline.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {investors.map((inv) => (
            <li key={inv.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{inv.name}</p>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                    Added by you
                  </span>
                  {inv.invited ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                      Invited
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {[inv.firm, inv.source ? SOURCE_LABELS[inv.source] ?? inv.source : null, inv.check_size]
                    .filter(Boolean)
                    .join(" · ") || "No details"}
                </p>
                {inv.notes ? <p className="mt-1 line-clamp-2 text-xs text-slate-400">{inv.notes}</p> : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  STATUS_STYLE[inv.status] ?? STATUS_STYLE.tracking
                }`}
              >
                {STATUS_LABELS[inv.status] ?? inv.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add an interested investor</h3>
                <p className="mt-0.5 text-xs text-slate-500">This stays private to you and feeds your pipeline.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Name" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Investor"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Firm">
                  <input
                    value={form.firm}
                    onChange={(e) => setForm({ ...form, firm: e.target.value })}
                    placeholder="Acme Ventures"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </Field>
                <Field label="Source">
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email (optional)">
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jane@acme.vc"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </Field>
                <Field label="Check size">
                  <input
                    value={form.checkSize}
                    onChange={(e) => setForm({ ...form, checkSize: e.target.value })}
                    placeholder="$50k"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </Field>
              </div>
              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="How you met, what they're interested in…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </Field>

              <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={form.invited}
                  onChange={(e) => setForm({ ...form, invited: e.target.checked })}
                  className="mt-0.5"
                />
                <span className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Also send them an invite to the platform</span>
                  <br />
                  Optional. Leave off to just track them privately. Requires an email.
                </span>
              </label>

              {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add investor"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
