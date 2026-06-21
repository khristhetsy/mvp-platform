import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadEngagementDetail } from "@/lib/diligence/data";

export const dynamic = "force-dynamic";

/** GET — full admin detail: engagement + domains + findings + claims. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const detail = await loadEngagementDetail(auth.supabase, id);
  if (!detail) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(detail);
}
