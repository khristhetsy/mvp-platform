import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachCourse } from "@/lib/learning/coach/courses";
import { loadCoachSnapshot } from "@/lib/learning/coach/snapshot-loader";

/**
 * GET: what the AI IR Coach reads about this founder, source by source, with provenance. Founder only,
 * own company only, and only while the coach is active. Loaded on demand, never on page render.
 */
export async function GET(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const courseSlug = new URL(request.url).searchParams.get("courseSlug")?.trim() ?? "";
  const course = getCoachCourse(courseSlug);
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const { company } = await getActiveCompanyForUser(auth.profile);
  const access = await getCoachAccess(auth.supabase as unknown as SupabaseClient, {
    founderId: auth.profile.id,
    companyId: company?.id ?? null,
    courseSlug,
  });
  if (!access.active) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const snapshot = await loadCoachSnapshot({
    supabase: auth.supabase,
    founderId: auth.profile.id,
    companyId: company?.id ?? null,
    course,
  });
  return NextResponse.json(snapshot);
}
