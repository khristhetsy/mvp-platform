import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { crrFor } from "@/lib/crr/crr-for";
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

  // The rating gate, enforced where it cannot be clicked around. The matches
  // page locks the button; this refuses the request that skips the page.
  const crr = await crrFor(company.id);
  if (!crr.outreachUnlocked) {
    return NextResponse.json(
      {
        error: crr.score === null
          ? `Introductions open once your Capital Readiness Rating reaches ${crr.gate}. Yours has not been scored yet.`
          : `Introductions open at a Capital Readiness Rating of ${crr.gate}. Yours is ${crr.score}.`,
        code: "crr_gate",
        score: crr.score,
        gate: crr.gate,
      },
      { status: 403 },
    );
  }

  // Per-plan monthly cap on how many investor connection requests this founder
  // may send. Trial/basic use the basic cap; professional uses the professional
  // cap. Only genuinely NEW requests count (re-requesting the same investor is a
  // no-op and isn't charged).
  const [cfg, plan] = await Promise.all([getFounderConnectionConfig(), getUserPlan(founderId)]);

  // Brokered introductions are included from Basic up. Founders on the
  // grandfathered free plan see every profile but need a plan to request.
  const entitlements = founderEntitlements(plan);
  if (!entitlements.canBrokerIntros) {
    return NextResponse.json(
      {
        error: "Introduction requests are included in Basic and Professional. Upgrade to request introductions through iCFO.",
        code: "upgrade_required",
      },
      { status: 403 },
    );
  }

  const isPro = plan === "founder_professional";
  const cap = isPro ? cfg.monthlyByPlan.professional : cfg.monthlyByPlan.basic;
  const weeklyCap = cfg.weeklyByPlan ? (isPro ? cfg.weeklyByPlan.professional : cfg.weeklyByPlan.basic) : null;
  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // Weeks start Monday (UTC).
  const weekStart = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // Declined requests are given back, so they don't count toward the limit.
  async function countSince(since: string): Promise<number> {
    const [member, prospect] = await Promise.all([
      admin.from("intro_requests").select("id", { count: "exact", head: true }).eq("company_id", company!.id).neq("status", "declined").gte("created_at", since),
      admin.from("prospect_intro_requests").select("id", { count: "exact", head: true }).eq("founder_id", founderId).neq("status", "dismissed").gte("created_at", since),
    ]);
    return (member.count ?? 0) + (prospect.count ?? 0);
  }
  let capPeriod: "week" | "month" = "month";
  async function overCap(): Promise<boolean> {
    if (weeklyCap !== null && (await countSince(weekStart)) >= weeklyCap) {
      capPeriod = "week";
      return true;
    }
    capPeriod = "month";
    return (await countSince(monthStart)) >= cap;
  }
  const capError = () => {
    const limit = capPeriod === "week" ? weeklyCap : cap;
    const proWeekly = cfg.weeklyByPlan?.professional ?? null;
    const upsell = isPro
      ? ""
      : ` Upgrade to Professional for ${proWeekly !== null ? `${proWeekly} a week, ` : ""}up to ${cfg.monthlyByPlan.professional} a month.`;
    return NextResponse.json(
      {
        error: `You've used all ${limit} introduction requests for this ${capPeriod}.${upsell}`,
        code: "connection_cap_reached",
        cap: limit,
        period: capPeriod,
      },
      { status: 429 },
    );
  };

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
      direction: "founder_to_investor",
      requested_by: founderId,
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
