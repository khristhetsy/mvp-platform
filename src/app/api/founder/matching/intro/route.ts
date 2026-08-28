import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { isProspectInvestorId } from "@/lib/matching/prospect-investors";
import { createProspectIntroRequest } from "@/lib/matching/prospect-intros";
import { getFounderConnectionConfig } from "@/lib/settings/platform-settings";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { emailDispatchAllowedForUser, EMAIL_DISABLED_MESSAGE } from "@/lib/organizations/organizations";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

export const dynamic = "force-dynamic";

// POST /api/founder/matching/intro — the founder requests an introduction to an
// anonymized matched investor. `ref` is the opaque id from the match card.
//   - registered member → creates an intro_requests row (admin Intro Requests queue)
//   - CRM prospect      → logs a brokered-intro request for the iCapOS team
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { ref?: string; note?: string } | null;
  const ref = body?.ref?.trim();
  const note = body?.note?.trim();
  if (!ref) return NextResponse.json({ error: "ref is required." }, { status: 400 });

  const { company, org } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 400 });

  const admin = createServiceRoleClient();
  const founderId = auth.profile.id;

  // API-layer guard (spec §3a): demo / email-disabled accounts cannot dispatch.
  // Tightened to the ACTIVE org — the account in view decides, not any account.
  const emailBlocked = org
    ? !org.email_dispatch_enabled
    : !(await emailDispatchAllowedForUser(admin, founderId));
  if (emailBlocked) {
    return NextResponse.json({ error: EMAIL_DISABLED_MESSAGE, code: "email_disabled" }, { status: 403 });
  }

  // Per-plan monthly cap on how many investor connection requests this founder
  // may send. Trial/basic use the basic cap; professional uses the professional
  // cap. Only genuinely NEW requests count (re-requesting the same investor is a
  // no-op and isn't charged).
  const [cfg, plan] = await Promise.all([getFounderConnectionConfig(), getUserPlan(founderId)]);

  // Brokered introductions are a Professional (and Managed IR) capability. Free
  // and Basic can't request them — Basic reaches investors via DIY outreach.
  if (!founderEntitlements(plan).canBrokerIntros) {
    return NextResponse.json(
      {
        error:
          "Brokered introductions are a Professional feature. Upgrade to request intros, or use DIY outreach on Basic.",
        code: "upgrade_required",
      },
      { status: 403 },
    );
  }

  const cap = plan === "founder_professional" ? cfg.monthlyByPlan.professional : cfg.monthlyByPlan.basic;
  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  async function overCap(): Promise<boolean> {
    const [member, prospect] = await Promise.all([
      admin.from("intro_requests").select("id", { count: "exact", head: true }).eq("company_id", company!.id).gte("created_at", monthStart),
      admin.from("prospect_intro_requests").select("id", { count: "exact", head: true }).eq("founder_id", founderId).gte("created_at", monthStart),
    ]);
    return ((member.count ?? 0) + (prospect.count ?? 0)) >= cap;
  }
  const capError = () =>
    NextResponse.json(
      { error: `You've reached your plan's limit of ${cap} investor connection requests this month. Upgrade your plan or try again next month.`, code: "connection_cap_reached", cap },
      { status: 429 },
    );

  if (isProspectInvestorId(ref)) {
    // Prospect isn't a platform user — queue a brokered-intro request for the team.
    const { data: existingProspect } = await admin
      .from("prospect_intro_requests")
      .select("id")
      .eq("company_id", company.id)
      .eq("investor_ref", ref)
      .maybeSingle();
    if (!existingProspect && (await overCap())) return capError();
    await createProspectIntroRequest({ companyId: company.id, founderId, investorRef: ref, note });
    await recordFunnelEvent({ sessionId: `intro_${founderId}`, eventName: "intro_requested", organizationId: org?.id ?? null, properties: { brokered: true } });
    return NextResponse.json({ ok: true, brokered: true });
  }

  // Member investor: create an intro request if one isn't already open.
  const { data: existing } = await admin
    .from("intro_requests")
    .select("id")
    .eq("company_id", company.id)
    .eq("investor_id", ref)
    .maybeSingle();

  if (!existing) {
    if (await overCap()) return capError();
    const { error } = await admin.from("intro_requests").insert({
      company_id: company.id,
      org_id: org?.id ?? null,
      investor_id: ref,
      message: note || "Founder requested an introduction via the Matching Center.",
    } as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await recordFunnelEvent({ sessionId: `intro_${founderId}`, eventName: "intro_requested", organizationId: org?.id ?? null, properties: { brokered: false } });
  } else if (note) {
    // Intro already open — refresh its message with the founder's latest note.
    await admin.from("intro_requests").update({ message: note } as never).eq("id", (existing as { id: string }).id);
  }

  return NextResponse.json({ ok: true, brokered: false });
}
