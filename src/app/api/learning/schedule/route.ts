import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function GET() {
  try {
    const profile = await requireRole(["founder"]);
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return NextResponse.json({ data: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const { data } = await db
      .from("learning_course_schedules")
      .select("*")
      .eq("founder_id", profile.id)
      .eq("company_id", company.id)
      .maybeSingle();

    return NextResponse.json({ data: data ?? null });
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
      studyDays: number[];
      sessionMinutes: number;
      preferredTime: string;
      reminderEmail: boolean;
      reminderPush: boolean;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    await db.from("learning_course_schedules").upsert(
      {
        founder_id: profile.id,
        company_id: company.id,
        study_days: body.studyDays,
        session_minutes: body.sessionMinutes,
        preferred_time: body.preferredTime,
        reminder_email: body.reminderEmail,
        reminder_push: body.reminderPush,
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
