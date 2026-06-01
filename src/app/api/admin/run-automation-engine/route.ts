import { NextResponse } from "next/server";
import { runAutomationEngine } from "@/lib/automation/engine";
import { requireApiProfile } from "@/lib/api/auth";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  if (auth.profile.role !== "admin" && auth.profile.role !== "analyst") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = Boolean((body as { dryRun?: boolean }).dryRun);

  if (!dryRun && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Live automation passes require admin role." }, { status: 403 });
  }

  try {
    const result = await runAutomationEngine({
      triggerType: (body as { triggerType?: string }).triggerType,
      entityType: (body as { entityType?: string }).entityType,
      entityId: (body as { entityId?: string }).entityId,
      sourceEventId: (body as { sourceEventId?: string }).sourceEventId,
      dryRun,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Automation engine failed.";
    return NextResponse.json({ error: message, success: false }, { status: 400 });
  }
}
