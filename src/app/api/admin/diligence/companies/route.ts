import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listCompaniesForPicker } from "@/lib/diligence/companies";

export const dynamic = "force-dynamic";

/** GET — companies for the New Engagement picker. */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const companies = await listCompaniesForPicker(auth.supabase);
  return NextResponse.json({ companies });
}
