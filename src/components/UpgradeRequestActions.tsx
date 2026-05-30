"use client";

import { useState } from "react";
import type { UpgradeRequestType } from "@/lib/billing/upgrade";
import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";

type Props = Readonly<{
  requestedPlan?: PlanType | null;
  featureKey?: FeatureKey | null;
  compact?: boolean;
}>;

export function UpgradeRequestActions({ requestedPlan, featureKey, compact = false }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<UpgradeRequestType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(requestType: UpgradeRequestType) {
    setLoading(requestType);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/billing/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          requestedPlan: requestedPlan ?? null,
          featureKey: featureKey ?? null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit request.");
      }

      setStatus(payload.message ?? "Request received. We will follow up when billing is live.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit request.");
    } finally {
      setLoading(null);
    }
  }

  const buttonClass = compact
    ? "rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    : "rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className={`flex flex-wrap gap-3 ${compact ? "" : "mt-2"}`}>
        <button
          type="button"
          className={`${buttonClass} bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500`}
          disabled={loading != null}
          onClick={() => submit("request_upgrade")}
        >
          {loading === "request_upgrade" ? "Submitting..." : "Request upgrade"}
        </button>
        <button
          type="button"
          className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
          disabled={loading != null}
          onClick={() => submit("contact_sales")}
        >
          {loading === "contact_sales" ? "Submitting..." : "Contact sales"}
        </button>
        <button
          type="button"
          className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
          disabled={loading != null}
          onClick={() => submit("notify_billing_live")}
        >
          {loading === "notify_billing_live" ? "Submitting..." : "Notify me when billing is live"}
        </button>
      </div>
      {status ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!compact ? (
        <p className="text-xs text-slate-500">
          Payment checkout is not enabled yet. Requests are logged for the CapitalOS team — no charges will be made.
        </p>
      ) : null}
    </div>
  );
}
