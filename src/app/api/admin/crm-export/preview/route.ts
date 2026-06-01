import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { buildCrmExportPreview } from "@/lib/crm-connectors/preview";
import { logCrmExportPreviewed } from "@/lib/crm-connectors/audit";
import { parseCrmExportEntityType } from "@/lib/crm-connectors/validation";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const entityType = parseCrmExportEntityType(new URL(request.url).searchParams.get("entityType"));
  if (!entityType) {
    return NextResponse.json({ error: "Invalid entityType." }, { status: 400 });
  }

  const preview = await buildCrmExportPreview(entityType);

  const supabase = createServiceRoleClient();
  await logCrmExportPreviewed(supabase, auth.profile, {
    entityType,
    rowCount: preview.rowCount,
  });

  return NextResponse.json({ preview });
}
