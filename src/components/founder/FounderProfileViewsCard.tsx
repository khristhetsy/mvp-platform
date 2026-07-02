import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getTranslations } from "next-intl/server";

type InvestorTypeRow = {
  investor_type: string | null;
};

type ActivityRow = {
  created_at: string;
  investor_profiles: InvestorTypeRow | InvestorTypeRow[] | null;
};

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

async function loadViewData(companyId: string) {
  const admin = createServiceRoleClient();

  // Load all report_viewed events for this company + join investor_profiles for type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await (admin as any)
    .from("investor_activity")
    .select("created_at, investor_profiles!investor_id(investor_type)")
    .eq("company_id", companyId)
    .eq("activity_type", "report_viewed")
    .order("created_at", { ascending: false });
  const { data, error } = raw as { data: ActivityRow[] | null; error: unknown };

  if (error || !data) {
    return { total: 0, recentCount: 0, typeBreakdown: {} as Record<string, number> };
  }

  const cutoff = sevenDaysAgo();
  let recentCount = 0;
  const typeBreakdown: Record<string, number> = {};

  for (const row of data) {
    if (row.created_at > cutoff) recentCount++;

    const profileRow = Array.isArray(row.investor_profiles)
      ? row.investor_profiles[0]
      : row.investor_profiles;
    const type = profileRow?.investor_type ?? "unknown";

    // Map raw DB values to display labels
    const label =
      type === "venture_fund"
        ? "VC"
        : type === "individual"
          ? "Angel"
          : type === "angel_group"
            ? "Angel group"
            : type === "family_office"
              ? "Family office"
              : type === "corporate"
                ? "Corporate"
                : "Other";

    typeBreakdown[label] = (typeBreakdown[label] ?? 0) + 1;
  }

  return { total: data.length, recentCount, typeBreakdown };
}

export async function FounderProfileViewsCard({ companyId }: { companyId: string }) {
  const t = await getTranslations("founderCmp");
  const { total, recentCount, typeBreakdown } = await loadViewData(companyId);

  const typeEntries = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...typeEntries.map(([, c]) => c));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("profile_views")}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Investors who opened your diligence report — anonymized by type
        </p>
      </div>

      <div className="p-5">
        {/* Summary numbers */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-indigo-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-indigo-800">{total}</p>
            <p className="mt-0.5 text-[11px] font-medium text-indigo-600">{t("total_views")}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-800">{recentCount}</p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-600">{t("last_7_days")}</p>
          </div>
        </div>

        {/* Type breakdown */}
        {typeEntries.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Viewer types
            </p>
            {typeEntries.map(([label, count]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-400 transition-all"
                    style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No report views yet. Publishing your profile makes it discoverable to approved investors.
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-2.5">
        <p className="text-[10px] text-slate-400">
          Investor identities are anonymized — only type is shown
        </p>
      </div>
    </div>
  );
}
