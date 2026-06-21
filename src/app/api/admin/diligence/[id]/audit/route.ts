import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listDdAudit } from "@/lib/diligence/audit";

export const dynamic = "force-dynamic";

/** GET — the engagement's audit chain. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const audit = await listDdAudit(auth.supabase, id);
  return NextResponse.json({ audit });
}
