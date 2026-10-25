"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { canDowngrade, type DowngradeTarget } from "@/lib/billing/plan-change";
import { PLAN_LABELS, PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";

type Props = {
  planType: PlanType;
  cancelAtPeriodEnd: boolean;
  cancelReason: string | null;
  pendingPlan: PlanType | null;
  periodEnd: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Downgrade and stop payment for card plans (Lemon Squeezy). Access lasts to the end of the paid period. */
export function PlanActions({ planType, cancelAtPeriodEnd, cancelReason, pendingPlan, periodEnd }: Readonly<Props>) {
  const t = useTranslations("billingManage");
  const router = useRouter();
  const [panel, setPanel] = useState<"none" | "downgrade" | "stop">("none");
  const [sel, setSel] = useState<DowngradeTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = fmt(periodEnd);
  const planName = PLAN_LABELS[planType];
  const targets = (["basic", "free"] as DowngradeTarget[]).filter((x) => canDowngrade(planType, x));
  const hasPending = Boolean(pendingPlan) || cancelAtPeriodEnd;
  const basicPrice = `$${Math.round(PLAN_PRICES.founder_basic / 100)}`;

  async function act(action: string, plan?: DowngradeTarget) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("error_generic"));
      setPanel("none");
      setSel(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  function schedule() {
    if (!sel) {
      setError(t("error_choose"));
      return;
    }
    void act("downgrade", sel);
  }

  const targetName = pendingPlan ? PLAN_LABELS[pendingPlan] : "";

  return (
    <div className="mt-4 space-y-3">
      {hasPending && cancelReason !== "deletion" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {pendingPlan
              ? t("banner_downgrade", { target: targetName, date, plan: planName })
              : t("banner_stopped", { plan: planName, date })}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(pendingPlan ? "undo_downgrade" : "resume")}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy ? t("working") : pendingPlan ? t("undo_downgrade", { plan: planName }) : t("resume_payment")}
          </button>
        </div>
      ) : null}

      {!hasPending && targets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => { setPanel(panel === "downgrade" ? "none" : "downgrade"); setError(null); }}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("downgrade_plan")}
          </button>
          <button
            type="button"
            onClick={() => { setPanel(panel === "stop" ? "none" : "stop"); setError(null); }}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            {t("stop_payment")}
          </button>
        </div>
      ) : null}

      {panel === "downgrade" && !hasPending ? (
        <div className="rounded-xl border border-slate-300 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{t("choose_lower_plan")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("takes_effect", { date })}</p>
          <div role="radiogroup" aria-label={t("choose_lower_plan")} className="mt-3 grid gap-2 sm:grid-cols-2">
            {targets.map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={sel === x}
                onClick={() => { setSel(x); setError(null); }}
                className={`rounded-lg border p-3 text-left text-sm ${sel === x ? "border-2 border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <span className="block font-semibold text-slate-900">{x === "basic" ? t("option_basic") : t("option_free")}</span>
                <span className="block text-xs text-slate-500">
                  {x === "basic" ? t("option_basic_sub", { price: basicPrice }) : t("option_free_sub")}
                </span>
              </button>
            ))}
          </div>
          {sel ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{t("lose_title")}</p>
              <p className="mt-0.5 text-slate-600">{planType === "founder_professional" ? t("lose_pro") : t("lose_basic_free")}</p>
              <p className="mt-2 font-semibold text-slate-900">{t("keep_title")}</p>
              <p className="mt-0.5 text-slate-600">{t("keep_text")}</p>
              <p className="mt-2 text-slate-600">
                {sel === "basic" ? t("note_basic", { price: basicPrice, date }) : t("note_free", { date })}
              </p>
            </div>
          ) : null}
          <p className="mt-2 min-h-[1.25rem] text-sm text-red-700" role="alert">{error}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setPanel("none"); setSel(null); setError(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {t("cancel")}
            </button>
            <button type="button" disabled={busy} onClick={schedule} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {busy ? t("working") : t("schedule_downgrade")}
            </button>
          </div>
        </div>
      ) : null}

      {panel === "stop" && !hasPending ? (
        <div className="rounded-xl border border-red-200 bg-white p-4">
          <p className="text-sm font-semibold text-red-800">{t("stop_title")}</p>
          <p className="mt-1 text-sm text-slate-600">{t("stop_body", { date })}</p>
          <p className="mt-2 min-h-[1.25rem] text-sm text-red-700" role="alert">{error}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setPanel("none"); setError(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {t("stop_keep")}
            </button>
            <button type="button" disabled={busy} onClick={() => void act("stop")} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? t("working") : t("stop_confirm")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
