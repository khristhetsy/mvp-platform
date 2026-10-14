"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";

type Plan = { planType: string; enabled: boolean; postsPerMonth: number | null };
type UsageRow = { profileId: string; name: string; usage: { planType: string | null; limit: number | null; used: number; state: string; resetAt: string } };

const PLAN_LABEL: Record<string, string> = {
  founder_free: "Free (due diligence only)",
  founder_basic: "Basic, $49",
  founder_professional: "Professional, $199",
  founder_premium: "Premium, $1,000",
};
const ORDER = ["founder_free", "founder_basic", "founder_professional", "founder_premium"];

function resetLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
}

export function FounderSocialControls() {
  const [master, setMaster] = useState(true);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [saved, setSaved] = useState<{ master: boolean; plans: Plan[] } | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/social/founder-limits");
        if (!res.ok) return;
        const j = await res.json();
        if (!active) return;
        const sorted = [...(j.plans ?? [])].sort((a: Plan, b: Plan) => ORDER.indexOf(a.planType) - ORDER.indexOf(b.planType));
        setMaster(Boolean(j.master));
        setPlans(sorted);
        setSaved({ master: Boolean(j.master), plans: sorted });
        setUsage(j.usage ?? []);
      } catch { /* section stays hidden */ }
    })();
    return () => { active = false; };
  }, []);

  function patch(planType: string, change: Partial<Plan>) {
    setMsg(null);
    setPlans((prev) => (prev ? prev.map((p) => (p.planType === planType ? { ...p, ...change } : p)) : prev));
  }

  async function save() {
    if (!plans) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/social/founder-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master, plans }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved({ master: Boolean(j.master), plans: j.plans ?? plans });
        setMsg({ text: "Saved. Applies to the next founder request.", ok: true });
      } else {
        setMsg({ text: j.error ?? "Could not save.", ok: false });
      }
    } catch {
      setMsg({ text: "Could not save.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (!saved) return;
    setMaster(saved.master);
    setPlans(saved.plans);
    setMsg(null);
  }

  if (!plans) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <Share2 className="h-5 w-5 text-[var(--gold,#B8860B)]" strokeWidth={1.75} aria-hidden /> Founder social media
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Shows Social media under Outreach for founders on the plans below. One post sent to several networks counts once, each recurring
        occurrence counts, and drafts and AI agent use do not. The cycle is 30 days from the founder&rsquo;s signup date, in PT.
        At the limit, Schedule and Post now show an upgrade dialog; posts already scheduled still go out.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <input type="checkbox" checked={master} onChange={(e) => { setMaster(e.target.checked); setMsg(null); }} />
            Feature on
          </label>
          <div className="flex items-center gap-3">
            {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
            <button type="button" onClick={cancel} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Access</th>
              <th className="px-4 py-2 font-medium">Posts per month</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.planType} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{PLAN_LABEL[p.planType] ?? p.planType}</td>
                <td className="px-4 py-3">
                  <input type="checkbox" aria-label={`${PLAN_LABEL[p.planType] ?? p.planType} access`} checked={p.enabled} onChange={(e) => patch(p.planType, { enabled: e.target.checked })} />
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      disabled={!p.enabled}
                      placeholder="Unlimited"
                      value={p.postsPerMonth ?? ""}
                      onChange={(e) => patch(p.planType, { postsPerMonth: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                    <span className="text-xs text-slate-500">{p.enabled && p.postsPerMonth === null ? "no limit" : "up to"}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">Usage this cycle</div>
        {usage.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No founders on a plan with social media access yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Founder</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Used</th>
                <th className="px-4 py-2 font-medium">Resets (PT)</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((r) => (
                <tr key={r.profileId} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">{r.name}</td>
                  <td className="px-4 py-2 text-slate-600">{PLAN_LABEL[r.usage.planType ?? ""]?.split(",")[0] ?? r.usage.planType}</td>
                  <td className={`px-4 py-2 ${r.usage.state === "reached" ? "text-red-700" : r.usage.state === "warn" ? "text-amber-700" : "text-slate-700"}`}>
                    {r.usage.used} / {r.usage.limit ?? "unlimited"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{resetLabel(r.usage.resetAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
