import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { getSiteDefaultView, setSiteDefaultView, SITE_DEFAULT_VIEW_TAG } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

/** GET — what public visitors see first: "ai" (AI mode) or "browse" (regular pages). */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ view: await getSiteDefaultView() });
}

const putSchema = z.object({ view: z.enum(["ai", "browse"]) });

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const ok = await setSiteDefaultView(parsed.data.view, auth.userId);
  if (!ok) return NextResponse.json({ error: "Could not save the default view." }, { status: 500 });

  // Expire the cached setting so the public site picks up the change on the next load.
  revalidateTag(SITE_DEFAULT_VIEW_TAG, { expire: 0 });

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.site_default_view_updated",
    entityType: "platform_settings",
    entityId: "site_default_view",
    metadata: { view: parsed.data.view },
  });

  return NextResponse.json({ success: true, view: parsed.data.view });
}
