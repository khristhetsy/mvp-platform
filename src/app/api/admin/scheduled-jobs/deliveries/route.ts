import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { isCronPath } from "@/lib/cron/jobs";
import { getJobDelivery, listJobDeliveries } from "@/lib/cron/job-deliveries";

export const dynamic = "force-dynamic";

/**
 * GET ?job=/api/cron/...  what that job sent in the last 30 days.
 * GET ?id=123             one email or in-app message in full.
 * System access only, like the rest of Scheduled jobs.
 */
export async function GET(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const params = new URL(request.url).searchParams;
  const id = Number(params.get("id"));
  if (params.get("id")) {
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const delivery = await getJobDelivery(id);
    return delivery ? NextResponse.json({ delivery }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const job = params.get("job") ?? "";
  if (!isCronPath(job)) return NextResponse.json({ error: "Not a scheduled job." }, { status: 400 });
  return NextResponse.json({ deliveries: await listJobDeliveries(job) });
}
