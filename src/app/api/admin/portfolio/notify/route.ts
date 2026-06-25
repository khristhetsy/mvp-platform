import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { listAllInvestmentsAdmin } from "@/lib/portfolio/db";
import { STALE_VAL_DAYS } from "@/lib/portfolio/types";

/**
 * POST /api/admin/portfolio/notify
 * Sends one in-app notification to each investor that has stale self-reported
 * valuations (older than STALE_VAL_DAYS, or none on record), asking them to update.
 */
export async function POST(): Promise<NextResponse> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const investments = await listAllInvestmentsAdmin();

    const staleMs = STALE_VAL_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const stale = investments.filter(
      (inv) =>
        inv.source === "self_reported" &&
        (inv.val_updated_at === null || now - new Date(inv.val_updated_at).getTime() > staleMs),
    );

    if (stale.length === 0) {
      return NextResponse.json({ notified: 0, investments: 0 });
    }

    // Group stale companies by investor.
    const byInvestor = new Map<string, string[]>();
    for (const inv of stale) {
      const list = byInvestor.get(inv.investor_user_id) ?? [];
      list.push(inv.company_name);
      byInvestor.set(inv.investor_user_id, list);
    }

    const today = new Date().toISOString().slice(0, 10);
    let notified = 0;

    await Promise.all(
      [...byInvestor.entries()].map(async ([investorId, companies]) => {
        const names =
          companies.length <= 3
            ? companies.join(", ")
            : `${companies.slice(0, 3).join(", ")} +${companies.length - 3} more`;
        const result = await createNotification({
          recipientUserId: investorId,
          type: "portfolio_valuation_stale",
          title: "Update your portfolio valuations",
          message: `${companies.length} of your tracked investment${companies.length === 1 ? "" : "s"} (${names}) ${companies.length === 1 ? "has" : "have"} a valuation older than ${STALE_VAL_DAYS} days or none on record. Please update ${companies.length === 1 ? "it" : "them"} in your portfolio.`,
          entityType: "portfolio",
          severity: "warning",
          deepLink: "/investor/portfolio",
          dedupeKey: `portfolio_stale:${investorId}:${today}`,
        });
        if (result) notified += 1;
      }),
    );

    return NextResponse.json({ notified, investments: stale.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
