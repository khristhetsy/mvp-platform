import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { seedSpvParticipationsFromInterests } from "@/lib/spv/spv-workflow";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const result = await seedSpvParticipationsFromInterests(auth.supabase, id, auth.profile.id);

  if (result.error) {
    return NextResponse.json({ error: "Unable to seed participations." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_seed_participations",
    entityType: "spv_opportunity",
    entityId: id,
    metadata: { created: result.created },
  });

  return NextResponse.json({ created: result.created });
}
