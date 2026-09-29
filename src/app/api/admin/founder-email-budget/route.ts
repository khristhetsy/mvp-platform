import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { loadBudgetConfig, saveBudgetConfig } from "@/lib/notifications/founder-email-budget/config";

export const dynamic = "force-dynamic";

/** GET: the founder email budget rules. System access only. */
export async function GET() {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ config: await loadBudgetConfig({ fresh: true }) });
}

/** PUT: save the rules. Values are clamped, so a bad field never breaks sending. */
export async function PUT(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { config?: unknown } | null;
  if (!body?.config) return NextResponse.json({ error: "Send the rules." }, { status: 400 });
  const before = await loadBudgetConfig({ fresh: true });
  const saved = await saveBudgetConfig(body.config, auth.profile.id);
  if (!saved) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "founder_email_budget.updated",
    entityType: "platform_setting",
    metadata: { before, after: saved },
  }).catch(() => {});
  return NextResponse.json({ ok: true, config: saved });
}
