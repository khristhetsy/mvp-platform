import Link from "next/link";
import type { OpenRatingItem } from "@/lib/crr/open-items";
import type { IntroQuota } from "@/lib/matching/intro-quota";

/** One plan's reach once introductions unlock. Every value comes from config. */
export type PlanReach = {
  monthlyIntros: number;
  /** null = no weekly cap. */
  weeklyIntros: number | null;
  /** null = uncapped. */
  investorCap: number | null;
  presentsMonthly: boolean;
  price: string;
};

/**
 * Shown below the outreach gate: the rating against the gate, and the open
 * items from the founder's own rating that stand between them and it. For a
 * Basic founder it also shows what Professional adds once they unlock, and
 * says plainly that upgrading does not skip the rating.
 */
export function IntroGateLockedCard({
  score,
  gate,
  pointsToGate,
  matchCount,
  items,
  upgrade,
}: {
  score: number | null;
  gate: number;
  pointsToGate: number;
  matchCount: number;
  items: OpenRatingItem[];
  upgrade?: { basic: PlanReach; professional: PlanReach } | null;
}) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, Math.round((score / Math.max(gate, 1)) * 100)));
  return (
    <div className="mb-4 rounded-xl border border-[#E3E8F2] bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-[#0A1A40]">Introductions unlock at CRR {gate}</div>
          <div className="text-[12px] text-[#5A6782]">
            {matchCount} match{matchCount === 1 ? "" : "es"} waiting for you
          </div>
        </div>
        <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-900">
          {score === null ? "Not scored yet" : `You are at ${score}`}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-[#E3E8F2]" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-[#1A6CE4]" style={{ width: `${pct}%` }} />
      </div>

      {items.length > 0 ? (
        <div className="mt-3">
          <div className="text-[12px] text-[#5A6782]">Open items from your rating</div>
          <ul className="mt-1 space-y-1">
            {items.map((item) => (
              <li key={`${item.factor}:${item.label}`} className="flex gap-2 text-[13px] text-[#16223F]" title={item.detail || undefined}>
                <span className="text-amber-600" aria-hidden="true">!</span>
                <span>
                  <span className="font-medium">{item.factor}</span> · {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href="/founder/readiness/wizard"
        className="mt-3 inline-block rounded-lg bg-[#1A6CE4] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#2E78F5]"
      >
        {score === null ? "Run your rating" : `See the ${pointsToGate} points`}
      </Link>

      {upgrade ? <PlanReachTable gate={gate} basic={upgrade.basic} professional={upgrade.professional} /> : null}
    </div>
  );
}

function reachCap(n: number | null): string {
  return n === null ? "No cap" : `Up to ${n}`;
}

function PlanReachTable({ gate, basic, professional }: { gate: number; basic: PlanReach; professional: PlanReach }) {
  const rows: Array<[string, string, string]> = [
    ["Introductions per month", String(basic.monthlyIntros), String(professional.monthlyIntros)],
    [
      "Introductions per week",
      basic.weeklyIntros === null ? "No weekly cap" : String(basic.weeklyIntros),
      professional.weeklyIntros === null ? "No weekly cap" : String(professional.weeklyIntros),
    ],
    ["Matched investors reached", reachCap(basic.investorCap), reachCap(professional.investorCap)],
    ["Monthly presentation slot", basic.presentsMonthly ? "Yes" : "No", professional.presentsMonthly ? "Yes" : "No"],
    ["Price", basic.price, professional.price],
  ];
  return (
    <div className="mt-4 border-t border-[#E3E8F2] pt-3.5">
      <div className="text-[13px] font-semibold text-[#0A1A40]">When you unlock, your plan decides how far you reach</div>
      <table className="mt-2 w-full table-fixed text-[13px] text-[#16223F]">
        <thead>
          <tr className="text-left text-[12px]">
            <th className="w-[44%] pb-1 font-normal" />
            <th className="pb-1 font-normal text-[#5A6782]">Basic · yours</th>
            <th className="pb-1 font-semibold text-[#1A6CE4]">Professional</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, b, p]) => (
            <tr key={label}>
              <td className="py-1">{label}</td>
              <td className="py-1">{b}</td>
              <td className="py-1 font-semibold">{p}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-[#5A6782]">
        Introductions open at CRR {gate} on every plan. Upgrading does not skip the rating.
      </p>
      <Link
        href="/founder/settings/billing"
        className="mt-2 inline-block rounded-lg border border-[#C9D6EE] px-3.5 py-2 text-[13px] font-semibold text-[#1A6CE4] hover:bg-[#F4F6FB]"
      >
        Compare plans
      </Link>
    </div>
  );
}

const PLAN_LABEL: Record<string, string> = {
  founder_basic: "Basic",
  founder_professional: "Professional",
  founder_managed_ir: "Managed IR",
  admin_internal: "Internal",
};

/** Shown above the gate: introductions used against this plan's caps. */
export function IntroQuotaStrip({
  quota,
  plan,
  professionalMonthlyCap,
}: {
  quota: IntroQuota;
  plan: string | null;
  professionalMonthlyCap: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3E8F2] bg-white px-4 py-2.5 text-[13px]">
      <span className="text-[#16223F]">Introductions through iCFO</span>
      <span className="flex flex-wrap items-center gap-4 text-[#16223F]">
        {quota.week ? (
          <span>
            This week <span className="font-semibold">{quota.week.used} of {quota.week.cap}</span>
          </span>
        ) : null}
        <span>
          This month <span className="font-semibold">{quota.month.used} of {quota.month.cap}</span>
        </span>
      </span>
      <span className="flex items-center gap-3 text-[12px] text-[#5A6782]">
        {plan ? PLAN_LABEL[plan] ?? null : null}
        {plan === "founder_basic" ? (
          <Link href="/founder/settings/billing" className="font-semibold text-[#1A6CE4] underline">
            Upgrade for {professionalMonthlyCap} a month
          </Link>
        ) : null}
      </span>
    </div>
  );
}
