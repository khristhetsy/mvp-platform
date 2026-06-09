import { NextResponse } from "next/server";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const url = new URL(request.url);
  const moduleSlug = url.searchParams.get("moduleSlug");
  const lessonId = url.searchParams.get("lessonId");
  if (!moduleSlug || !lessonId) {
    return NextResponse.json({ error: "moduleSlug and lessonId are required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("founder_worksheet_submissions")
    .select("id, content, submitted_at, admin_feedback, founder_id, company_id, profiles:founder_id(full_name, email), companies:company_id(company_name)")
    .eq("module_slug", moduleSlug)
    .eq("lesson_id", lessonId)
    .order("submitted_at", { ascending: false });

  if (error) return jsonBadRequest(error);

  type WorksheetRow = {
    id: string;
    content: string;
    submitted_at: string;
    admin_feedback: string | null;
    profiles: { full_name?: string | null; email?: string | null } | null;
    companies: { company_name?: string | null } | null;
  };

  const submissions = ((data ?? []) as WorksheetRow[]).map((row) => ({
    id: row.id,
    content: row.content,
    submittedAt: row.submitted_at,
    adminFeedback: row.admin_feedback,
    founderName: row.profiles?.full_name ?? row.profiles?.email ?? "Founder",
    companyName: row.companies?.company_name ?? "Company",
  }));

  return NextResponse.json({ submissions });
}

export async function PATCH(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  const feedback = typeof body.feedback === "string" ? body.feedback : "";
  if (!submissionId) return NextResponse.json({ error: "submissionId is required." }, { status: 400 });

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("founder_worksheet_submissions")
    .update({
      admin_feedback: feedback,
      feedback_given_at: now,
      feedback_given_by: auth.profile.id,
    })
    .eq("id", submissionId);

  if (error) return jsonBadRequest(error);
  return NextResponse.json({ ok: true });
}
