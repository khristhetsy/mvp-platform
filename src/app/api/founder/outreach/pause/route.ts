import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { setFounderOutreachPaused } from "@/lib/outreach/investor-outreach";

export const dynamic = "force-dynamic";

/**
 * Founder pause/resume for their own automated outreach. Body: { paused: boolean }.
 * This is the founder-facing off switch — it does not require an env change and
 * only affects the signed-in founder's own company campaign.
 */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { paused?: unknown } | null;
  if (typeof body?.paused !== "boolean") {
    return NextResponse.json({ error: "Expected { paused: boolean }." }, { status: 400 });
  }

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ error: "No company found." }, { status: 404 });
  }

  const ok = await setFounderOutreachPaused(company.id, auth.profile.id, body.paused);
  if (!ok) {
    return NextResponse.json({ error: "Automated outreach isn't set up yet." }, { status: 409 });
  }

  return NextResponse.json({ paused: body.paused });
}
