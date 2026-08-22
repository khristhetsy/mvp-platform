import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { getUploadLimits, setUploadLimits, UPLOAD_LIMIT_CEILING } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

/** GET — current founder upload limits (with the hard ceilings for the UI). */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limits = await getUploadLimits();
  return NextResponse.json({ limits, ceiling: UPLOAD_LIMIT_CEILING });
}

const putSchema = z.object({
  maxMb: z.number().int().min(1).max(UPLOAD_LIMIT_CEILING.maxMb),
  maxPages: z.number().int().min(1).max(UPLOAD_LIMIT_CEILING.maxPages),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const saved = await setUploadLimits(parsed.data, auth.userId);
  if (!saved) return NextResponse.json({ error: "Could not save upload limits." }, { status: 500 });

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.upload_limits_updated",
    entityType: "platform_settings",
    entityId: "upload_limits",
    metadata: { limits: saved },
  });

  return NextResponse.json({ success: true, limits: saved });
}
