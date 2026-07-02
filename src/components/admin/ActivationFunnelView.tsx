import { useTranslations } from "next-intl";
import type { FunnelStep } from "@/lib/analytics/activation-funnels";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function FunnelColumn({ title, steps, accent }: { title: string; steps: FunnelStep[]; accent: string }) {
  const top = steps[0]?.count ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2.5">
        {steps.map((s, i) => {
          const width = top > 0 ? Math.max(4, (s.count / top) * 100) : 4;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{s.label}</span>
                <span className="tabular-nums font-medium text-slate-900">
                  {s.count.toLocaleString()}
                  {s.fromPrev !== null ? (
                    <span className={`ml-2 text-xs ${s.fromPrev < 0.5 ? "text-rose-600" : "text-slate-400"}`}>
                      {pct(s.fromPrev)} ↓
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${width}%`, background: accent }} />
              </div>
              {i > 0 ? (
                <p className="mt-0.5 text-[11px] text-slate-400">{pct(s.fromTop)} of signups</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivationFunnelView({
  founder,
  investor,
  generatedAt,
}: {
  founder: FunnelStep[];
  investor: FunnelStep[];
  generatedAt: string;
}) {
  const t = useTranslations("adminCmp");
  // Biggest single drop in each funnel (worst fromPrev), for the callouts.
  const worst = (steps: FunnelStep[]) =>
    steps
      .filter((s) => s.fromPrev !== null)
      .reduce<FunnelStep | null>((acc, s) => (acc === null || (s.fromPrev ?? 1) < (acc.fromPrev ?? 1) ? s : acc), null);
  const fWorst = worst(founder);
  const iWorst = worst(investor);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("admin_reports")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{t("activation_funnels")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          How founders and investors progress from signup to activation, computed live from your data. The red percentage marks the biggest drop between steps — that&apos;s where to focus.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelColumn title={t("founder_activation")} steps={founder} accent="#2E78F5" />
        <FunnelColumn title={t("investor_activation")} steps={investor} accent="#1D9E75" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fWorst ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">{t("founder_bottleneck")}</span> only {pct(fWorst.fromPrev ?? 0)} reach &ldquo;{fWorst.label}&rdquo; from the prior step.
          </div>
        ) : null}
        {iWorst ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">{t("investor_bottleneck")}</span> only {pct(iWorst.fromPrev ?? 0)} reach &ldquo;{iWorst.label}&rdquo; from the prior step.
          </div>
        ) : null}
      </div>

      <p className="text-xs text-slate-400">Generated {new Date(generatedAt).toLocaleString()}.</p>
    </div>
  );
}
