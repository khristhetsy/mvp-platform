import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { isCronPath } from "@/lib/cron/jobs";
import { setCronsPaused } from "@/lib/cron/gate";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(50),
  paused: z.boolean(),
});

/** POST /api/admin/scheduled-jobs: pause or resume scheduled jobs. System access only. */
export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send paths and paused." }, { status: 400 });

  const unknown = parsed.data.paths.filter((p) => !isCronPath(p));
  if (unknown.length) return NextResponse.json({ error: `Not a scheduled job: ${unknown.join(", ")}` }, { status: 400 });

  const next = await setCronsPaused(parsed.data.paths, parsed.data.paused, {
    id: auth.profile.id,
    name: auth.profile.full_name ?? auth.profile.email ?? null,
  });
  if (!next) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: parsed.data.paused ? "scheduled_job.paused" : "scheduled_job.resumed",
    entityType: "scheduled_job",
    metadata: { paths: parsed.data.paths },
  }).catch(() => {});

  return NextResponse.json({ ok: true, paused: next });
}
