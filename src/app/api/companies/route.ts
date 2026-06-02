import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { createCompany, listFounderCompanies } from "@/lib/data/companies";
import { companyCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiProfile(["founder", "admin", "analyst"]);

  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role === "founder") {
    const { data, error } = await listFounderCompanies(auth.supabase, auth.profile.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ companies: data });
  }

  // Admin/analyst listing is capped and field-limited for safety.
  const { data, error } = await auth.supabase
    .from("companies")
    .select(
      "id, company_name, review_status, status, is_published, marketplace_visible, published_at, created_at, founder_id, slug",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ companies: data });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);

  if ("error" in auth) {
    return auth.error;
  }

  const parsed = companyCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await createCompany(auth.supabase, {
    ...parsed.data,
    founder_id: auth.profile.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "company.created",
    entityType: "company",
    entityId: data.id,
  });

  return NextResponse.json({ company: data }, { status: 201 });
}
