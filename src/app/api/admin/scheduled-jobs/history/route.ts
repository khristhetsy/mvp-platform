import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { isCronPath } from "@/lib/cron/jobs";
import { loadJobRunHistory } from "@/lib/cron/run-history";

export const dynamic = "force-dynamic";

/** GET /api/admin/scheduled-jobs/history?job=/api/cron/...: the last runs of one job. System access only. */
export async function GET(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const job = new URL(request.url).searchParams.get("job") ?? "";
  if (!isCronPath(job)) return NextResponse.json({ error: "Not a scheduled job." }, { status: 400 });

  return NextResponse.json({ runs: await loadJobRunHistory(job) });
}
