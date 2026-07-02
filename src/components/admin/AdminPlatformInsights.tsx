import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type Insight = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  href?: string;
  linkLabel?: string;
};

const SEVERITY_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  high:   { dot: "bg-red-500",    bg: "border-red-100 bg-red-50",    text: "text-red-800" },
  medium: { dot: "bg-amber-400",  bg: "border-amber-100 bg-amber-50", text: "text-amber-800" },
  low:    { dot: "bg-slate-300",  bg: "border-slate-100 bg-slate-50", text: "text-slate-700" },
};

async function loadInsights(): Promise<Insight[]> {
  const admin = createServiceRoleClient();
  const now = new Date();
  const insights: Insight[] = [];

  // 1. Stale pending company reviews (> 3 days)
  const staleReviewCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleReviews } = await admin
    .from("company_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .lt("submitted_at", staleReviewCutoff)
    .limit(0);

  if (staleReviews && staleReviews > 0) {
    insights.push({
      id: "stale_reviews",
      severity: staleReviews >= 3 ? "high" : "medium",
      title: `${staleReviews} pending review${staleReviews !== 1 ? "s" : ""} over 3 days old`,
      detail: "Company applications submitted more than 3 days ago with no admin action.",
      href: "/admin/companies",
      linkLabel: "Review queue →",
    });
  }

  // 2. Stale intro requests (> 5 days in requested/reviewing)
  const staleIntroCutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleIntros } = await admin
    .from("intro_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["requested", "reviewing"])
    .lt("created_at", staleIntroCutoff)
    .limit(0);

  if (staleIntros && staleIntros > 0) {
    insights.push({
      id: "stale_intros",
      severity: staleIntros >= 5 ? "high" : "medium",
      title: `${staleIntros} intro request${staleIntros !== 1 ? "s" : ""} pending for 5+ days`,
      detail: "Investor intro requests in 'requested' or 'reviewing' status for more than 5 days.",
      href: "/admin/crm/outreach",
      linkLabel: "Intro queue →",
    });
  }

  // 3. Approved investors with zero activity (>14 days after approval)
  const idleInvestorCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: approvedRecently } = await admin
    .from("investor_profiles")
    .select("profile_id")
    .eq("approval_status", "approved")
    .lt("approved_at", idleInvestorCutoff)
    .limit(200);

  if (approvedRecently && approvedRecently.length > 0) {
    const approvedIds = approvedRecently.map((r) => r.profile_id);

    const { data: activeInvestors } = await admin
      .from("investor_interests")
      .select("investor_id")
      .in("investor_id", approvedIds);

    const activeSet = new Set((activeInvestors ?? []).map((r) => r.investor_id));

    const { data: savedInvestors } = await admin
      .from("saved_deals")
      .select("investor_id")
      .in("investor_id", approvedIds);

    for (const r of savedInvestors ?? []) activeSet.add(r.investor_id);

    const idleCount = approvedIds.filter((id) => !activeSet.has(id)).length;

    if (idleCount > 0) {
      insights.push({
        id: "idle_investors",
        severity: idleCount >= 10 ? "high" : "low",
        title: `${idleCount} approved investor${idleCount !== 1 ? "s" : ""} with no marketplace activity`,
        detail: "Approved 14+ days ago with no interests or saved deals. Consider a re-engagement email.",
        href: "/admin/investors",
        linkLabel: "Investors →",
      });
    }
  }

  // 4. Companies published with zero investor interest (> 7 days since publish)
  const noInterestCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: publishedCompanies } = await admin
    .from("companies")
    .select("id")
    .eq("status", "published")
    .lt("published_at", noInterestCutoff)
    .limit(200);

  if (publishedCompanies && publishedCompanies.length > 0) {
    const pubIds = publishedCompanies.map((r) => r.id);

    const { data: withInterest } = await admin
      .from("investor_interests")
      .select("company_id")
      .in("company_id", pubIds);

    const withInterestSet = new Set((withInterest ?? []).map((r) => r.company_id));
    const noInterestCount = pubIds.filter((id) => !withInterestSet.has(id)).length;

    if (noInterestCount > 0) {
      insights.push({
        id: "no_interest_companies",
        severity: noInterestCount >= 5 ? "medium" : "low",
        title: `${noInterestCount} published compan${noInterestCount !== 1 ? "ies" : "y"} with no investor interest`,
        detail: "Published 7+ days ago with zero expressed interests. May need better matching or founder profile enrichment.",
        href: "/admin/companies",
        linkLabel: "Companies →",
      });
    }
  }

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return insights;
}

export async function AdminPlatformInsights() {
  const t = await getTranslations("adminCmp");
  const insights = await loadInsights();

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold text-slate-900">{t("platform_insights")}</p>
        </div>
        <p className="mt-1.5 text-sm text-slate-500">{t("no_anomalies_detected_platform_operating_nor")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t("platform_insights")}</p>
          <p className="mt-0.5 text-xs text-slate-500">Automated anomaly detection · {insights.length} item{insights.length !== 1 ? "s" : ""} flagged</p>
        </div>
        {insights.some((i) => i.severity === "high") && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            {insights.filter((i) => i.severity === "high").length} high priority
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {insights.map((insight) => {
          const style = SEVERITY_STYLES[insight.severity];
          return (
            <div key={insight.id} className={`flex items-start gap-3 px-6 py-4 ${style.bg} border-l-0`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${style.text}`}>{insight.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{insight.detail}</p>
              </div>
              {insight.href && insight.linkLabel && (
                <Link
                  href={insight.href}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {insight.linkLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
