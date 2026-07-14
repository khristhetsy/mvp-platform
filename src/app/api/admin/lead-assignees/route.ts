import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listAssignableStaff, getSalesSettings, updateSalesSettings } from "@/lib/sales/settings";

export const dynamic = "force-dynamic";

/** GET — all staff + the currently-eligible lead-assignee ids (empty = all eligible). */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [staff, settings] = await Promise.all([listAssignableStaff(), getSalesSettings()]);
  return NextResponse.json({ staff, eligibleIds: settings.leadAssigneeIds });
}

const putSchema = z.object({ eligibleIds: z.array(z.string().uuid()).max(500) });

/** PUT — set which members may appear in a contact's "Assigned to" picker. */
export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await updateSalesSettings({ leadAssigneeIds: parsed.data.eligibleIds });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
