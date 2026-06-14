import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { completeLesson } from "@/lib/learning/lesson-progress";

export async function POST(request: Request) {
  try {
    const profile = await requireRole(["founder"]);
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const { moduleSlug, lessonId } = (await request.json()) as {
      moduleSlug: string;
      lessonId: string;
    };

    if (!moduleSlug || !lessonId) {
      return NextResponse.json({ error: "Missing moduleSlug or lessonId" }, { status: 400 });
    }

    await completeLesson({
      founderId: profile.id,
      companyId: company.id,
      moduleSlug,
      lessonId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/learning/lessons/complete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
