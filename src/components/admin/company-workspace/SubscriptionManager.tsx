"use client";

import { useCallback, useEffect, useState } from "react";

type CompDuration = "30d" | "6m" | "1y" | "indefinite";

type View = {
  exists: boolean;
  status: string | null;
  planType: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  canComp?: boolean;
  extendDays?: number;
};

const DURATIONS: { key: CompDuration; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "6m", label: "6 months" },
  { key: "1y", label: "1 year" },
  { key: "indefinite", label: "Indefinite" },
];

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusPill(status: string | null) {
  const map: Record<string, string> = {
    trialing: "bg-amber-50 text-amber-700",
    active: "bg-emerald-50 text-emerald-700",
    expired: "bg-red-50 text-red-700",
    canceled: "bg-slate-100 text-slate-600",
    free: "bg-slate-100 text-slate-600",
    internal: "bg-indigo-50 text-indigo-700",
  };
  const cls = status ? map[status] ?? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{status ?? "none"}</span>;
}

export function SubscriptionManager({ profileId }: Readonly<{ profileId: string }>) {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState<CompDuration>("1y");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/subscription/${profileId}`);
      if (!res.ok) {
        setError("Failed to load subscription.");
        return;
      }
      setView((await res.json()) as View);
      setError(null);
    } catch {
      setError("Network error loading subscription.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const act = useCallback(
    async (action: "extend" | "comp") => {
      if (busy) return;
      setBusy(true);
      setMsg(null);
      setError(null);
      try {
        const res = await fetch(`/api/admin/subscription/${profileId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action === "comp" ? { action, duration } : { action }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Action failed.");
          return;
        }
        const updated = (await res.json()) as View;
        setView((prev) => ({ ...(prev ?? {}), ...updated }));
        setMsg(action === "extend" ? "Trial extended — access restored, no payment taken." : "Plan comped — full access granted.");
      } catch {
        setError("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [busy, duration, profileId],
  );

  if (loading) return <p className="text-sm text-slate-500">Loading subscription…</p>;
  if (!view) return <p className="text-sm text-rose-600">{error ?? "Could not load subscription."}</p>;

  if (!view.exists) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        This founder has no subscription record yet (it&apos;s created when they start onboarding).
      </div>
    );
  }

  const extendDays = view.extendDays ?? 15;

  return (
    <div className="space-y-4">
      {/* Current state */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Status</span>
            {statusPill(view.status)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Plan</span>
            <span className="font-medium text-slate-800">{view.planType ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Trial ends</span>
            <span className="font-medium text-slate-800">{fmtDate(view.trialEndsAt)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Access until</span>
            <span className="font-medium text-slate-800">{fmtDate(view.currentPeriodEnd)}</span>
          </div>
        </div>
      </div>

      {/* Extend trial — admin/analyst */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Extend trial</h3>
        <p className="mt-0.5 text-xs text-slate-500">Adds {extendDays} days of trial access. No payment required.</p>
        <button
          type="button"
          onClick={() => act("extend")}
          disabled={busy}
          className="mt-3 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          Extend trial {extendDays} days
        </button>
      </div>

      {/* Comp plan — super admin only */}
      {view.canComp ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Comp a full plan <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">SUPER ADMIN</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">Grants Founder Professional with no trial expiry for the chosen duration.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as CompDuration)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
            >
              {DURATIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => act("comp")}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              Comp plan
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Comping a full plan is restricted to super admins.</p>
      )}

      {msg ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{msg}</p> : null}
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <p className="text-[11px] text-slate-400">Every change is written to the audit trail with your admin id.</p>
    </div>
  );
}
