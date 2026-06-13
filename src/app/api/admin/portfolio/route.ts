import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { listAllInvestmentsAdmin } from "@/lib/portfolio/db";
import { STALE_VAL_DAYS } from "@/lib/portfolio/types";

/** GET /api/admin/portfolio — all investors' investments with investor name */
export async function GET(): Promise<NextResponse> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const investments = await listAllInvestmentsAdmin();

    const staleMs = STALE_VAL_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const enriched = investments.map((inv) => {
      const isStale =
        inv.source === "self_reported" &&
        (inv.val_updated_at === null ||
          now - new Date(inv.val_updated_at).getTime() > staleMs);
      return { ...inv, is_stale: isStale };
    });

    // Aggregate stats
    const totalInvested   = enriched.reduce((s, i) => s + Number(i.amount_invested), 0);
    const linkedCount     = enriched.filter((i) => i.source === "deal_room").length;
    const staleCount      = enriched.filter((i) => i.is_stale).length;
    const investorIds     = new Set(enriched.map((i) => i.investor_user_id));

    // Avg return (only rows with both entry + current val)
    const returnable = enriched.filter(
      (i) => i.entry_valuation && i.current_valuation && i.entry_valuation > 0,
    );
    const avgMultiple =
      returnable.length > 0
        ? returnable.reduce(
            (s, i) => s + Number(i.current_valuation) / Number(i.entry_valuation),
            0,
          ) / returnable.length
        : null;

    return NextResponse.json({
      investments: enriched,
      stats: {
        total_invested:    totalInvested,
        total_deals:       enriched.length,
        investor_count:    investorIds.size,
        linked_count:      linkedCount,
        stale_count:       staleCount,
        avg_multiple:      avgMultiple,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
