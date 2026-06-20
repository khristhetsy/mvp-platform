import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireManageUsersApi } from "@/lib/api/permissions";

/**
 * GET /api/admin/users/dependents?userId=<uuid>
 *
 * Returns the "blast radius" of a hard delete: counts of the records that will
 * cascade-delete (or be detached) when this user is permanently removed.
 * Mirrors the on-delete policy in migration 20260620002 — OWNED data cascades
 * with the user (companies and everything under them, deal rooms, the
 * investor's own interests); ACTOR/audit references are set null and are not
 * counted here because they survive the delete.
 *
 * Read-only. Each count is best-effort: a missing table/column yields 0 rather
 * than failing the whole request, so the UI always renders.
 */

type CountItem = { key: string; label: string; count: number };

async function safeCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => any
): Promise<number> {
  try {
    const { count, error } = await build();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error as Response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;

  // Companies the user owns drive most of the cascade.
  let companyIds: string[] = [];
  try {
    const { data } = await admin.from("companies").select("id").eq("founder_id", userId);
    companyIds = (data ?? []).map((c: { id: string }) => c.id);
  } catch {
    companyIds = [];
  }
  const hasCompanies = companyIds.length > 0;

  const [documents, dealRooms, investorInterests, diligenceReports, campaigns] = await Promise.all([
    safeCount(() =>
      hasCompanies
        ? admin.from("documents").select("id", { count: "exact", head: true }).in("company_id", companyIds)
        : admin.from("documents").select("id", { count: "exact", head: true }).eq("company_id", "00000000-0000-0000-0000-000000000000")
    ),
    safeCount(() =>
      admin
        .from("deal_rooms")
        .select("id", { count: "exact", head: true })
        .or(`founder_id.eq.${userId},investor_user_id.eq.${userId}`)
    ),
    safeCount(() =>
      admin.from("investor_interests").select("id", { count: "exact", head: true }).eq("investor_id", userId)
    ),
    safeCount(() =>
      admin.from("diligence_reports").select("id", { count: "exact", head: true }).eq("investor_id", userId)
    ),
    safeCount(() =>
      hasCompanies
        ? admin.from("campaigns").select("id", { count: "exact", head: true }).in("company_id", companyIds)
        : admin.from("campaigns").select("id", { count: "exact", head: true }).eq("company_id", "00000000-0000-0000-0000-000000000000")
    ),
  ]);

  const items: CountItem[] = [
    { key: "companies", label: "Companies", count: companyIds.length },
    { key: "documents", label: "Documents", count: documents },
    { key: "deal_rooms", label: "Deal rooms", count: dealRooms },
    { key: "investor_interests", label: "Investor interests", count: investorInterests },
    { key: "diligence_reports", label: "Diligence reports", count: diligenceReports },
    { key: "campaigns", label: "Campaigns", count: campaigns },
  ];

  const total = items.reduce((sum, i) => sum + i.count, 0);

  return NextResponse.json({ userId, items, total });
}
