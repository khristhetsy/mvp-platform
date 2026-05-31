import type { InvestorSpvNextAction } from "@/lib/spv/readiness";

export function InvestorSpvNextActionBanner({
  action,
}: Readonly<{ action: InvestorSpvNextAction | null }>) {
  if (!action) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Your next SPV action</p>
      <p className="mt-2 text-lg font-semibold">{action.label}</p>
      <p className="mt-1 leading-6">{action.detail}</p>
    </section>
  );
}
