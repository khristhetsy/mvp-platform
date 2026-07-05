import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listEngagements } from "@/lib/diligence/data";
import { daysSince, ONBOARDING_SLA_DAYS, DILIGENCE_SLA_DAYS } from "@/lib/operations/escalations";

export const dynamic = "force-dynamic";

type Advice = { id: string; title: string; message: string; actions: { label: string; href: string; primary?: boolean }[] };

// Deterministic, grounded suggestions from real onboarding + diligence data.
// Non-intrusive nudges — never auto-acts.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const admin = createServiceRoleClient();
  const suggestions: Advice[] = [];

  // Stalled onboarding
  const { data: companies } = await admin
    .from("companies")
    .select("id, onboarding_completed_at, updated_at")
    .is("onboarding_completed_at", null);
  const stalled = ((companies ?? []) as Array<{ id: string; updated_at: string | null }>).filter((c) => daysSince(c.updated_at) >= ONBOARDING_SLA_DAYS);
  if (stalled.length > 0) {
    suggestions.push({
      id: "onboarding_stalled",
      title: "Onboarding stalls detected",
      message: `${stalled.length} founder${stalled.length === 1 ? " is" : "s are"} past the ${ONBOARDING_SLA_DAYS}-day onboarding SLA. Review them and assign an owner so they don't slip further.`,
      actions: [
        { label: "Review in Lifecycle", href: "/admin/operations-hub/lifecycle", primary: true },
        { label: "Open dashboard", href: "/admin/operations-hub" },
      ],
    });
  }

  // Diligence awaiting review
  const engagements = await listEngagements(admin).catch(() => []);
  const review = engagements.filter((e) => e.lifecycle_stage === "admin_review" && daysSince(e.updated_at) >= DILIGENCE_SLA_DAYS);
  if (review.length > 0) {
    suggestions.push({
      id: "diligence_review",
      title: "Diligence waiting on you",
      message: `${review.length} diligence engagement${review.length === 1 ? " has" : "s have"} sat in Admin review past the ${DILIGENCE_SLA_DAYS}-day SLA. Clearing these unblocks the founders.`,
      actions: [{ label: "Open diligence", href: "/admin/diligence", primary: true }],
    });
  }

  return NextResponse.json({ suggestions });
}
