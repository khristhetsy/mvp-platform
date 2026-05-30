import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import type { Database } from "@/lib/supabase/types";

export type PublicPlatformMetrics = {
  totalCommittedAmount: number;
  totalCommittedCurrency: string;
  expressedInterestCount: number;
  readinessImprovementPercent: number | null;
};

type InterestAmountRow = {
  pledge_amount: number | null;
  interest_amount: number | null;
  pledge_currency: string | null;
};

type ReadinessReportRow = {
  company_id: string;
  readiness_score: number | null;
  created_at: string;
};

export async function getPublicPlatformMetrics(
  supabase: SupabaseClient<Database>,
): Promise<PublicPlatformMetrics> {
  const [interestsResult, reportsResult] = await Promise.all([
    supabase.from("investor_interests").select("pledge_amount, interest_amount, pledge_currency"),
    supabase
      .from("diligence_reports")
      .select("company_id, readiness_score, created_at")
      .not("readiness_score", "is", null),
  ]);

  const interests = (interestsResult.data ?? []) as InterestAmountRow[];
  let totalCommittedAmount = 0;
  let totalCommittedCurrency = "USD";

  for (const row of interests) {
    const pledgeAmount = row.pledge_amount != null ? Number(row.pledge_amount) : 0;
    if (pledgeAmount <= 0) {
      continue;
    }

    if (row.pledge_currency) {
      totalCommittedCurrency = row.pledge_currency;
    }

    totalCommittedAmount += pledgeAmount;
  }

  const expressedInterestCount = interests.length;

  let readinessImprovementPercent: number | null = null;

  if (!reportsResult.error && reportsResult.data?.length) {
    const reports = reportsResult.data as ReadinessReportRow[];
    const scoresByCompany = new Map<string, { score: number; created_at: string }[]>();

    for (const row of reports) {
      if (row.readiness_score == null) {
        continue;
      }

      const bucket = scoresByCompany.get(row.company_id) ?? [];
      bucket.push({ score: Number(row.readiness_score), created_at: row.created_at });
      scoresByCompany.set(row.company_id, bucket);
    }

    let eligibleCompanies = 0;
    let improvedCompanies = 0;

    for (const scores of scoresByCompany.values()) {
      if (scores.length < 2) {
        continue;
      }

      scores.sort((left, right) => left.created_at.localeCompare(right.created_at));
      eligibleCompanies += 1;

      if (scores[scores.length - 1]!.score > scores[0]!.score) {
        improvedCompanies += 1;
      }
    }

    if (eligibleCompanies > 0) {
      readinessImprovementPercent = Math.round((improvedCompanies / eligibleCompanies) * 100);
    }
  }

  return {
    totalCommittedAmount,
    totalCommittedCurrency,
    expressedInterestCount,
    readinessImprovementPercent,
  };
}

export function formatPublicCommittedTotal(amount: number, currency = "USD") {
  if (amount <= 0) {
    return formatPledgeTotal(0, currency);
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = millions >= 10 ? String(Math.round(millions)) : millions.toFixed(1).replace(/\.0$/, "");
    return `$${label}M+`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K+`;
  }

  return `${formatPledgeTotal(amount, currency)}+`;
}

export function formatPublicInterestCount(count: number) {
  return count > 0 ? `${count}+` : "0";
}

export function formatPublicReadinessImprovement(percent: number | null) {
  return percent == null ? "Tracking soon" : `${percent}%`;
}
