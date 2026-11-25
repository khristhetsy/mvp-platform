"use client";

import { useState } from "react";

/**
 * Social media alerts: whether iCapOS tells the founder when a scheduled post goes live,
 * in the bell and by email. Both are on until the founder changes them. Failed posts are
 * never sent to the founder, so there is no switch for them.
 */
export function SocialPostAlerts({ initial }: Readonly<{ initial: { inApp: boolean; email: boolean } }>) {
  const [inApp, setInApp] = useState(initial.inApp);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/social-alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inApp, email }),
      });
      if (!res.ok) throw new Error("Couldn't save. Try again.");
      setMessage({ tone: "ok", text: "Saved." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<{ id: string; label: string; desc: string; on: boolean; set: (v: boolean) => void }> = [
    { id: "social-alert-bell", label: "Alert in iCapOS when a post goes live", desc: "Shows in the bell and on your notifications page.", on: inApp, set: setInApp },
    { id: "social-alert-email", label: "Email when a post goes live", desc: "Sent to your account email, with a link to the live post.", on: email, set: setEmail },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Social media alerts</h2>
          <p className="mt-0.5 text-xs text-slate-500">One alert for each post and account, the moment it is published.</p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <span className={`text-xs ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span> : null}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 rounded-lg bg-[#1A6CE4] px-5 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <ul className="px-6 py-2">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-slate-100 py-3 last:border-b-0">
            <label htmlFor={r.id} className="flex cursor-pointer items-start gap-3">
              <input
                id={r.id}
                type="checkbox"
                checked={r.on}
                onChange={(e) => { r.set(e.target.checked); setMessage(null); }}
                className="mt-0.5 h-4 w-4 accent-[#1A6CE4]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-900">{r.label}</span>
                <span className="text-xs text-slate-500">{r.desc}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
