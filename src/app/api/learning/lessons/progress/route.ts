import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";

export async function GET(request: Request) {
  try {
    const profile = await requireRole(["founder"]);
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return NextResponse.json({ completed: false });

    const { searchParams } = new URL(request.url);
    const moduleSlug = searchParams.get("moduleSlug");
    const lessonId = searchParams.get("lessonId");

    if (!moduleSlug || !lessonId) {
      return NextResponse.json({ completed: false });
    }

    const progress = await listLessonProgressForCompany(profile.id, company.id);
    const completed = progress.some(
      (r) => r.module_slug === moduleSlug && r.lesson_id === lessonId && r.status === "completed",
    );

    return NextResponse.json({ completed });
  } catch (error) {
    console.error("[api/learning/lessons/progress]", error);
    return NextResponse.json({ completed: false });
  }
}
