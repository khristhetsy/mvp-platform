/**
 * Social campaigns + ROI rollup. A campaign groups posts under a name and a manual
 * budget. Attribution rides the campaign's source_tag: published post links carry
 * ?s=<source_tag>, the /fit funnel records it as the session source, and the Sales
 * Hub handoff writes it to the contact's lead_source. So signups — and the
 * subscription revenue they become — trace back to the campaign.
 *
 * ROI = attributed subscription revenue (monthly) ÷ budget. Server-only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Campaign = { id: string; name: string; budget_cents: number; source_tag: string };

export type CampaignReport = Campaign & {
  posts: number;
  published: number;
  signups: number;       // contacts attributed to this campaign (lead_source = source_tag)
  members: number;       // attributed contacts on a paying plan
  revenue_cents: number; // sum of monthly plan price for those members
  roi: number | null;    // revenue / budget, null when budget is 0
};

/** Paid plans that count toward attributed revenue (exclude free/trial/internal). */
const PAID_PLANS = new Set<PlanType>(["founder_basic", "founder_professional", "founder_managed_ir", "investor_pro", "investor_premium"]);

/** Short, URL-safe attribution tag derived from a fresh id. */
export function makeSourceTag(): string {
  return `camp_${(crypto.randomUUID?.() ?? String(Date.now())).replace(/-/g, "").slice(0, 8)}`;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const { data } = await db().from("social_campaigns").select("id, name, budget_cents, source_tag").is("archived_at", null).order("created_at", { ascending: false });
  return ((data ?? []) as Campaign[]).map((c) => ({ ...c, budget_cents: Number(c.budget_cents) || 0 }));
}

export async function createCampaign(name: string, budgetCents: number, createdBy?: string | null): Promise<Campaign | null> {
  const { data, error } = await db().from("social_campaigns")
    .insert({ name: name.trim(), budget_cents: Math.max(0, Math.round(budgetCents)), source_tag: makeSourceTag(), created_by: createdBy ?? null })
    .select("id, name, budget_cents, source_tag").single();
  if (error) return null;
  return data as Campaign;
}

/**
 * Pure roll-up: given campaigns and the raw counts/attribution rows, compute the
 * report per campaign. Kept separate from IO so it's unit-testable.
 */
export function rollupCampaigns(
  campaigns: Campaign[],
  postCountByCampaign: Map<string, number>,
  publishedByCampaign: Map<string, number>,
  membersByTag: Map<string, { signups: number; members: number; revenueCents: number }>,
): CampaignReport[] {
  return campaigns.map((c) => {
    const m = membersByTag.get(c.source_tag) ?? { signups: 0, members: 0, revenueCents: 0 };
    const budget = c.budget_cents || 0;
    return {
      ...c,
      posts: postCountByCampaign.get(c.id) ?? 0,
      published: publishedByCampaign.get(c.id) ?? 0,
      signups: m.signups,
      members: m.members,
      revenue_cents: m.revenueCents,
      roi: budget > 0 ? m.revenueCents / budget : null,
    };
  });
}

export async function campaignReports(): Promise<CampaignReport[]> {
  const campaigns = await listCampaigns();
  if (campaigns.length === 0) return [];
  const tags = campaigns.map((c) => c.source_tag);
  const ids = campaigns.map((c) => c.id);

  // Posts per campaign, and published-variant counts per campaign.
  const postCountByCampaign = new Map<string, number>();
  const publishedByCampaign = new Map<string, number>();
  const { data: posts } = await db().from("social_posts").select("id, campaign_id").in("campaign_id", ids);
  const postToCampaign = new Map<string, string>();
  for (const p of (posts ?? []) as { id: string; campaign_id: string }[]) {
    postToCampaign.set(p.id, p.campaign_id);
    postCountByCampaign.set(p.campaign_id, (postCountByCampaign.get(p.campaign_id) ?? 0) + 1);
  }
  const postIds = [...postToCampaign.keys()];
  if (postIds.length) {
    const { data: vars } = await db().from("social_variants").select("post_id, status").in("post_id", postIds).eq("status", "published");
    for (const v of (vars ?? []) as { post_id: string }[]) {
      const cid = postToCampaign.get(v.post_id);
      if (cid) publishedByCampaign.set(cid, (publishedByCampaign.get(cid) ?? 0) + 1);
    }
  }

  // Attributed contacts: lead_source (override) equals a campaign source_tag.
  const membersByTag = new Map<string, { signups: number; members: number; revenueCents: number }>();
  for (const t of tags) membersByTag.set(t, { signups: 0, members: 0, revenueCents: 0 });
  const { data: contacts } = await db().from("crm_contacts").select("email, overrides").in("overrides->>lead_source", tags);
  const rows = ((contacts ?? []) as { email: string | null; overrides: Record<string, unknown> | null }[]);
  // Resolve each attributed contact's plan via profiles → subscriptions (by email).
  const emails = [...new Set(rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean))];
  const emailToPlan = new Map<string, PlanType | null>();
  if (emails.length) {
    const { data: profs } = await db().from("profiles").select("id, email").in("email", emails);
    const profRows = ((profs ?? []) as { id: string; email: string | null }[]);
    const idToEmail = new Map<string, string>();
    for (const p of profRows) if (p.email) idToEmail.set(p.id, p.email.trim().toLowerCase());
    const profIds = profRows.map((p) => p.id);
    if (profIds.length) {
      const { data: subs } = await db().from("subscriptions").select("profile_id, plan_type").in("profile_id", profIds);
      for (const s of (subs ?? []) as { profile_id: string; plan_type: PlanType }[]) {
        const em = idToEmail.get(s.profile_id);
        if (em) emailToPlan.set(em, s.plan_type);
      }
    }
  }
  for (const r of rows) {
    const tag = (r.overrides?.lead_source as string | undefined) ?? "";
    const bucket = membersByTag.get(tag);
    if (!bucket) continue;
    bucket.signups += 1;
    const plan = emailToPlan.get((r.email ?? "").trim().toLowerCase());
    if (plan && PAID_PLANS.has(plan)) { bucket.members += 1; bucket.revenueCents += PLAN_PRICES[plan] ?? 0; }
  }

  return rollupCampaigns(campaigns, postCountByCampaign, publishedByCampaign, membersByTag);
}
