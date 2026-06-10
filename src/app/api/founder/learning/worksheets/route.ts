import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function GET(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const url = new URL(request.url);
  const moduleSlug = url.searchParams.get("moduleSlug");
  const lessonId = url.searchParams.get("lessonId");
  if (!moduleSlug || !lessonId) {
    return NextResponse.json({ error: "moduleSlug and lessonId are required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("founder_worksheet_submissions")
    .select("content, submitted_at, admin_feedback")
    .eq("founder_id", auth.profile.id)
    .eq("company_id", company.id)
    .eq("module_slug", moduleSlug)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    submission: data
      ? {
          content: data.content,
          submittedAt: data.submitted_at,
          adminFeedback: data.admin_feedback,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const moduleSlug = typeof body.moduleSlug === "string" ? body.moduleSlug : "";
  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!moduleSlug || !lessonId) {
    return NextResponse.json({ error: "moduleSlug and lessonId are required." }, { status: 400 });
  }
  if (content.length < 10 || content.length > 5000) {
    return NextResponse.json({ error: "Content must be between 10 and 5000 characters." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createServiceRoleClient();
  const { error } = await admin.from("founder_worksheet_submissions").upsert(
    {
      founder_id: auth.profile.id,
      company_id: company.id,
      module_slug: moduleSlug,
      lesson_id: lessonId,
      content,
      submitted_at: now,
    },
    { onConflict: "founder_id,company_id,module_slug,lesson_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, submittedAt: now });
}
