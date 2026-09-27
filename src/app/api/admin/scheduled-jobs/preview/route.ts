import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { JOB_PREVIEWS } from "@/lib/cron/job-previews";

export const dynamic = "force-dynamic";

/**
 * GET ?job=/api/cron/...  a dry run: who the job's next run would contact and
 * with what. Nothing is sent. Only jobs listed in JOB_PREVIEWS support it.
 * System access only, like the rest of Scheduled jobs.
 */
export async function GET(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const job = new URL(request.url).searchParams.get("job") ?? "";
  const preview = JOB_PREVIEWS[job];
  if (!preview) return NextResponse.json({ error: "This job has no preview." }, { status: 404 });
  try {
    return NextResponse.json({ label: preview.label, note: preview.note, items: await preview.load() });
  } catch {
    return NextResponse.json({ error: "Couldn't build the preview. Try again." }, { status: 500 });
  }
}
