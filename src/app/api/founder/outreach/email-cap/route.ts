/** GET → the founder's Manual outreach email cap for this 30 day period. */
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { founderLimits } from "@/lib/investor-directory/db";
import { resetLabel } from "@/lib/outreach/email-cap";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const l = await founderLimits(auth.profile.id);
  return NextResponse.json({
    plan: l.planLabel,
    topUp: l.topUp.key === "free" ? null : l.topUp.label,
    cap: l.emails,
    used: l.emailsUsed,
    remaining: Math.max(0, l.emails - l.emailsUsed),
    resetsAt: l.periodEnd,
    resetsLabel: resetLabel(l.periodEnd),
  });
}
