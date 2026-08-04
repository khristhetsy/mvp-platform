import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { setInvestorArchived } from "@/lib/investor/profile";

const schema = z.object({ archived: z.boolean() });

// POST /api/admin/investors/[id]/archive — soft-archive or restore an investor.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await setInvestorArchived(id, parsed.data.archived);
    try {
      await writeAuditLog(auth.supabase, {
        userId: auth.profile.id,
        action: parsed.data.archived ? "investor.archived" : "investor.restored",
        entityType: "investor_profile",
        entityId: id,
        metadata: { profile_id: result.profile_id },
      });
    } catch (auditError) {
      console.error("investor archive audit log failed", auditError);
    }
    return NextResponse.json({ archived: Boolean(result.archived_at) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update archive state.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
