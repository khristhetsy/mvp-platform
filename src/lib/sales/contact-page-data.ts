// Shared loader for the unified contact detail page, used by both the Sales Hub
// and Marketing Hub contact routes so they render the same record (crm_contacts)
// in their own shell. Returns null when the contact is missing or out of scope.
import { getContactProfile } from "@/lib/sales/contacts";
import { getSalesScope } from "@/lib/sales/scope";
import { listAssignableStaff, listLeadAssignableStaff } from "@/lib/sales/settings";
import { listContactActivity } from "@/lib/sales/activity";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { fetchPartnerMessages } from "@/lib/crm-connectors/odoo/messages";
import { listContactBookings } from "@/lib/scheduling/bookings";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { getContactInvestorRating } from "@/lib/investor-rating/contact-rating";
import { planLabelFor, type PlanType, type SubscriptionStatus } from "@/lib/subscriptions/plans";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { priceShort } from "@/lib/subscriptions/pricing-catalog";
import { parseOnboardingStepState } from "@/lib/onboarding/progress";
import { crrFor } from "@/lib/crr/crr-for";
import type { LinkedCompany, MemberPlan } from "@/app/admin/sales/contacts/[id]/ContactProfileClient";

/** Plain-English status, so the chip never shows a raw enum. */
const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trial",
  pending_payment: "Awaiting payment",
  expired: "Expired",
  canceled: "Canceled",
  free: "Free",
  internal: "Internal",
};

type ProfileLike = { id: string; email?: string | null; role?: string | null; is_super_admin?: boolean | null };

export async function loadContactPageProps(profile: ProfileLike, id: string) {
  const scope = await getSalesScope(profile);
  const data = await getContactProfile(id);
  if (!data) return null;
  if (!scope.canSeeAllContacts && !data.contact.assignee_ids.includes(scope.ownerId ?? "")) return null;

  const [staff, leadStaff] = scope.isManager
    ? await Promise.all([listAssignableStaff(), listLeadAssignableStaff()])
    : [[] as { id: string; name: string }[], [] as { id: string; name: string }[]];
  const activity = await listContactActivity(id);
  const bookings = await listContactBookings(id).catch(() => []);

  const odooMessages =
    data.contact.source === "odoo" && data.contact.external_id
      ? await fetchPartnerMessages(data.contact.external_id, 80)
      : [];

  let onePager: { slug: string | null; published: boolean; companyName: string | null } | null = null;
  let linkedCompany: LinkedCompany | null = null;
  let crr: { score: number; tier: string } | null = null;
  // Member Portal Plan — the contact's live subscription, when their email matches
  // a portal account. Read-only.
  //
  // This reads the whole row rather than the plan key alone. `founder_free` means
  // two different things — legitimately grandfathered, or a discontinued tier that
  // should not exist — and `PLAN_LABELS[plan]` cannot tell them apart. The price
  // comes from the active pricing catalogue, so it tracks a pricing change rather
  // than going stale in the UI.
  let memberPlan: MemberPlan | null = null;
  if (data.contact.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data: prof } = await admin.from("profiles").select("id").eq("email", data.contact.email).maybeSingle();
    if (prof?.id) {
      try {
        const { data: sub } = await admin
          .from("subscriptions")
          .select("plan_type, subscription_status, is_grandfathered, created_at")
          .eq("profile_id", prof.id)
          .maybeSingle();
        if (sub?.plan_type) {
          const planType = sub.plan_type as PlanType;
          const status = sub.subscription_status as SubscriptionStatus;
          const paid = planType !== "founder_free" && planType !== "founder_trial" && planType !== "investor_free";
          memberPlan = {
            label: planLabelFor(planType, Boolean(sub.is_grandfathered)),
            priceLabel: paid ? priceShort(await loadPricing(), planType) : null,
            status,
            statusLabel: STATUS_LABEL[status] ?? status,
            // The one case worth shouting about: free access with no entitlement to it.
            discontinued: planType === "founder_free" && !sub.is_grandfathered,
            since: sub.created_at ?? null,
          };
        }
      } catch { /* ignore — plan stays null, rendered as "not a portal member" */ }
      // One read, every column the panel needs. `readiness_score` used to be in
      // this list and has never existed on `companies` — it lives on
      // `company_readiness_scores` — so PostgREST failed the whole select and
      // the linked-company panel silently never rendered.
      const { data: comp, error: compError } = await admin
        .from("companies")
        .select(
          "id, slug, is_published, company_name, industry, revenue_stage, funding_amount," +
            " business_description, website, country, state, use_of_funds, onboarding_step_state," +
            " funding_stage, operating_stage, business_entity, annual_ebitda, management_team," +
            " seeking_investor_types, seeking_capital_types, active_investor_preference",
        )
        .eq("founder_id", prof.id)
        .maybeSingle();

      // A failed lookup is not the same as "this contact has no company", and
      // rendering it as one is what hid this for so long.
      if (compError) {
        console.error("[sales/contact] company lookup failed:", compError.message);
      }

      if (comp) {
        onePager = { slug: comp.slug ?? null, published: Boolean(comp.is_published), companyName: comp.company_name ?? null };
        linkedCompany = {
          id: comp.id,
          companyName: comp.company_name ?? null,
          industry: comp.industry ?? null,
          revenueStage: comp.revenue_stage ?? null,
          fundingAmount: comp.funding_amount ?? null,
          description: comp.business_description ?? null,
          website: comp.website ?? null,
          country: comp.country ?? null,
          state: comp.state ?? null,
          useOfFunds: comp.use_of_funds ?? null,
          fundingStage: comp.funding_stage ?? null,
          operatingStage: comp.operating_stage ?? null,
          businessEntity: comp.business_entity ?? null,
          annualEbitda: comp.annual_ebitda ?? null,
          managementTeam: comp.management_team ?? null,
          seekingInvestorTypes: comp.seeking_investor_types ?? null,
          seekingCapitalTypes: comp.seeking_capital_types ?? null,
          activeInvestorPreference: comp.active_investor_preference ?? null,
          // Seeking / Company & stage / Traction are all collected in the wizard's
          // `funding_information` step. Whether that step was submitted is what
          // separates "the founder hasn't been asked" from "asked and left blank" —
          // without it every gap renders as the same dash.
          fundingInfoCaptured: Boolean(
            parseOnboardingStepState(comp.onboarding_step_state).steps.funding_information?.completed,
          ),
        };

        // The real CRR, from the scoring table. The old chip divided a column
        // that doesn't exist into invented bands ("Raise-ready" at 80), which
        // had nothing to do with the engine's gate or its profile bands.
        // A company that has never been scored comes back with a null score and
        // no band — shown as no chip at all, rather than a zero.
        const real = await crrFor(comp.id).catch(() => null);
        if (real?.score != null && real.band) crr = { score: real.score, tier: real.band };
      }
    }
  }

  const investorRating = await getContactInvestorRating(data.contact).catch(() => null);

  // SEC Form D filing data for a promoted Form D investor (external_id = formd-firm:<id>).
  let formdFirm: FormdFirmSummary | null = null;
  const ext = data.contact.external_id;
  if (ext && ext.startsWith("formd-firm:")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createServiceRoleClient() as any;
      const { data: firm } = await admin
        .from("formd_firms")
        .select("regd_footprint, vehicle_count, fund_types, last_investment_at, last_investment_issuer, last_investment_round_size, activity_band, state_or_country, investments_24mo")
        .eq("id", ext.slice("formd-firm:".length))
        .maybeSingle();
      if (firm) formdFirm = firm as FormdFirmSummary;
    } catch { /* ignore */ }
  }

  return {
    contact: data.contact,
    opportunities: data.opportunities,
    staff,
    leadStaff,
    activity,
    isSuperAdmin: isSuperAdmin(profile),
    onePager,
    company: linkedCompany,
    odooMessages,
    bookings,
    investorRating,
    formdFirm,
    crr,
    memberPlan,
  };
}

export type FormdFirmSummary = {
  regd_footprint: number | null;
  vehicle_count: number | null;
  fund_types: string[] | null;
  last_investment_at: string | null;
  last_investment_issuer: string | null;
  last_investment_round_size: number | null;
  activity_band: string | null;
  state_or_country: string | null;
  investments_24mo: number | null;
};
