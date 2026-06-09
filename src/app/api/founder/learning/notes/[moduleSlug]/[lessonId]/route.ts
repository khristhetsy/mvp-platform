import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function GET(
  _: Request,
  { params }: Readonly<{ params: Promise<{ moduleSlug: string; lessonId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const { moduleSlug, lessonId } = await params;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("founder_lesson_notes")
    .select("content")
    .eq("founder_id", auth.profile.id)
    .eq("company_id", company.id)
    .eq("module_slug", moduleSlug)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  return NextResponse.json({ content: data?.content ?? "" });
}

export async function PATCH(
  request: Request,
  { params }: Readonly<{ params: Promise<{ moduleSlug: string; lessonId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const { moduleSlug, lessonId } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("founder_lesson_notes").upsert(
    {
      founder_id: auth.profile.id,
      company_id: company.id,
      module_slug: moduleSlug,
      lesson_id: lessonId,
      content,
      updated_at: now,
    },
    { onConflict: "founder_id,company_id,module_slug,lesson_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
