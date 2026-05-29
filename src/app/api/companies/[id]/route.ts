import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { companyUpdateSchema } from "@/lib/validation";

async function requireCompanyManager(supabase: any, userId: string, companyId: string) {
  const { data: membership, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 400 as const, error: error.message };
  }

  if (membership?.role === "owner" || membership?.role === "admin") {
    return { ok: true as const };
  }

  // Legacy fallback: founder_id owns the company.
  const { data: legacy } = await supabase.from("companies").select("id").eq("id", companyId).eq("founder_id", userId).maybeSingle();
  if (legacy) return { ok: true as const };

  return { ok: false as const, status: 403 as const, error: "You do not have permission to edit this company." };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = companyUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company settings.", details: parsed.error.flatten() }, { status: 400 });
  }

  const permission = await requireCompanyManager(auth.supabase, auth.profile.id, id);
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status });
  }

  const { data, error } = await auth.supabase.from("companies").update(parsed.data).eq("id", id).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "company.updated",
    entityType: "company",
    entityId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ company: data });
}

