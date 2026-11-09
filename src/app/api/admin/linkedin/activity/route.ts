import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { ACTIVITY_EXPORT_MAX, ACTIVITY_STATUSES, activityCsv, listActivity, type ActivityStatus } from "@/lib/linkedin/activity";
import { getOrCreateAccount } from "@/lib/linkedin/store";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET: the signed in admin's LinkedIn activity, newest first. ?format=csv downloads it. Staff only. */
export async function GET(req: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const campaignId = url.searchParams.get("campaign");
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const filters = {
      status: ACTIVITY_STATUSES.some((s) => s.id === status) ? (status as ActivityStatus) : undefined,
      campaignId: campaignId && UUID.test(campaignId) ? campaignId : undefined,
      q: url.searchParams.get("q") ?? undefined,
      page: Number.isFinite(page) ? page : 1,
    };
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    if (url.searchParams.get("format") === "csv") {
      const { rows } = await listActivity(account.id, { ...filters, page: 1, limit: ACTIVITY_EXPORT_MAX });
      return new Response(activityCsv(rows, account.timezone), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="linkedin-activity.csv"', "Cache-Control": "no-store" },
      });
    }
    const { rows, total } = await listActivity(account.id, filters);
    return NextResponse.json({ rows, total, timeZone: account.timezone });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load activity." }, { status: 500 });
  }
}
