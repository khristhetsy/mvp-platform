import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getFounderStudyStreak } from "@/lib/learning/progress";

export async function GET() {
  try {
    const profile = await requireRole(["founder"]);
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return NextResponse.json({ data: null, streak: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const [{ data }, streak] = await Promise.all([
      db
        .from("learning_course_schedules")
        .select("*")
        .eq("founder_id", profile.id)
        .eq("company_id", company.id)
        .maybeSingle(),
      getFounderStudyStreak(profile.id, company.id),
    ]);

    return NextResponse.json({ data: data ?? null, streak });
  } catch (error) {
    console.error("[api/learning/schedule GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole(["founder"]);
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const body = (await request.json()) as {
      studyDays: string[];
      sessionMinutes: number;
      preferredTime: string;
      remindersOn: boolean;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    await db.from("learning_course_schedules").upsert(
      {
        founder_id: profile.id,
        company_id: company.id,
        study_days: body.studyDays,
        days_per_week: body.studyDays.length,
        session_minutes: body.sessionMinutes,
        preferred_time: body.preferredTime,
        reminders_on: body.remindersOn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "founder_id,company_id" },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/learning/schedule POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
