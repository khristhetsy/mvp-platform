import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { updateCompanyStatus } from "@/lib/data/companies";

export async function POST(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireApiProfile(["admin"]);

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const { data, error } = await updateCompanyStatus(auth.supabase, id, "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auth.supabase.from("admin_reviews").insert({
    company_id: id,
    reviewed_by: auth.profile.id,
    status: "approved",
    notes: "Approved for campaign preparation.",
  });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "company.approved",
    entityType: "company",
    entityId: id,
  });

  return NextResponse.json({ company: data });
}
