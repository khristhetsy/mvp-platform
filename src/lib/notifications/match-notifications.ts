import { rankInvestorsForCompany } from "@/lib/matching/investor-company-matching";
import {
  loadAdminCompanyMatchProfiles,
  loadApprovedInvestorMatchProfiles,
} from "@/lib/matching/load-matching-data";
import { notifyCompanyFounderIfNotRecent, notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { createDraftFromMatch } from "@/lib/outreach/investor-outreach";

const STRONG_MATCH_THRESHOLD = 70;
// One notification per company per week — avoids re-firing every cron pass.
const DEDUPE_HOURS = 168;

/**
 * Scans marketplace companies for strong matches against APPROVED MEMBER investors
 * (prospects are excluded — they are internal/unverified and must not drive
 * founder-facing notifications). For each company with at least one strong match,
 * notifies the founder and staff once per week, routed through each recipient's
 * notification preferences (see createNotification → shouldDeliverInApp).
 */
export async function runMatchNotificationPass(): Promise<{ companiesNotified: number }> {
  const [companies, investors] = await Promise.all([
    loadAdminCompanyMatchProfiles(),
    loadApprovedInvestorMatchProfiles(),
  ]);

  if (investors.length === 0) {
    return { companiesNotified: 0 };
  }

  const marketplaceCompanies = companies.filter(
    (company) =>
      company.reviewStatus === "approved" &&
      company.isPublished &&
      company.marketplaceVisible &&
      Boolean(company.publishedAt),
  );

  let companiesNotified = 0;

  for (const company of marketplaceCompanies) {
    const ranked = rankInvestorsForCompany(company, investors, 50);
    const strong = ranked.filter((row) => row.match.matchScore >= STRONG_MATCH_THRESHOLD);
    if (strong.length === 0) {
      continue;
    }

    const topScore = strong[0]?.match.matchScore ?? STRONG_MATCH_THRESHOLD;
    const plural = strong.length === 1 ? "" : "es";

    await notifyCompanyFounderIfNotRecent(company.id, {
      type: "strong_investor_match",
      title: "New strong investor match",
      message: `${strong.length} investor match${plural} your profile strongly (top ${topScore}%) on iCapOS.`,
      entityType: "company",
      entityId: company.id,
      severity: "info",
      deepLink: "/founder/investors",
      withinHours: DEDUPE_HOURS,
    });

    await notifyStaffIfNotRecent({
      type: "strong_investor_match",
      title: "Strong investor match to facilitate",
      message: `${company.companyName}: ${strong.length} strong investor match${plural} (top ${topScore}%).`,
      entityType: "company",
      entityId: company.id,
      severity: "info",
      deepLink: `/admin/matching?company=${company.id}`,
      withinHours: DEDUPE_HOURS,
    });

    // Auto-draft an approval-gated outreach campaign (idempotent). Nothing sends
    // until an admin approves it.
    await createDraftFromMatch(company.id);

    companiesNotified += 1;
  }

  return { companiesNotified };
}
