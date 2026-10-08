import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getAllStageGuides } from "@/lib/founder/stage-guides";
import { isGuideStepHref, recordStepVisit } from "@/lib/founder/stage-step-memory";

export const dynamic = "force-dynamic";

// POST { href } — the founder opened a stage guide step. Steps with no
// measurable signal count as done once opened.
export async function POST(req: Request): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "founder") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { href?: unknown } | null;
  const href = typeof body?.href === "string" ? body.href : "";
  if (!href || !isGuideStepHref(getAllStageGuides(), href)) {
    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  }

  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ ok: true, skipped: "no_company" });

  await recordStepVisit(company.id, href);
  return NextResponse.json({ ok: true });
}
