// POST /api/mobile/stage-step-visit  { href }  (Authorization: Bearer <supabase access token>)
// Same as /api/founder/stage-steps/visit, for the phone: a guide step with no measurable signal
// counts as done once opened. New file, the website route is untouched.
import { NextResponse } from "next/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getAllStageGuides } from "@/lib/founder/stage-guides";
import { isGuideStepHref, recordStepVisit } from "@/lib/founder/stage-step-memory";
import { withBearerFounder } from "../_bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { href?: unknown } | null;
  const href = typeof body?.href === "string" ? body.href : "";
  if (!href || !isGuideStepHref(getAllStageGuides(), href)) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  const result = await withBearerFounder(req, async ({ profile }) => {
    const { company } = await getActiveCompanyForUser(profile);
    if (!company) return { skipped: "no_company" as const };
    await recordStepVisit(company.id, href);
    return { skipped: null };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json({ ok: true });
}
