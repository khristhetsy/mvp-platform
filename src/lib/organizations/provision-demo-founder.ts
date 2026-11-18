import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import type { PlanType } from "@/lib/subscriptions/plans";
import type { Organization } from "@/lib/organizations/organizations";

// An admin-created Founder account (demo or internal) is an organization PLUS a founder
// profile and a company, the same three records a real signup ends up with. Without the
// founder and company there is nothing for "Open as founder" or Select company to open.
// The founder login has no password and a placeholder address that cannot receive mail,
// so nobody can sign in as it and no email can reach it. Staff reach it through
// "Open as founder" only.

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export type DemoFounderResult = { founderId: string; companyId: string; created: boolean };

/** Placeholder address on a reserved TLD (RFC 2606): never deliverable. */
export function demoFounderEmail(orgId: string): string {
  return `demo-${orgId}@demo.icapos.invalid`;
}

export function demoPlanForTier(tier: Organization["tier"]): PlanType {
  return tier === "basic" ? "founder_basic" : "founder_professional";
}

/** Links the demo founder to the org so the email dispatch guard sees the org's setting. */
async function linkFounderToOrg(admin: unknown, founderId: string, orgId: string) {
  const { error } = await loose(admin)
    .from("memberships")
    .upsert({ user_id: founderId, org_id: orgId, role: "owner" }, { onConflict: "user_id,org_id" });
  if (error) throw new Error(`Could not link the founder to the account: ${error.message}`);
}

/**
 * Creates the founder profile, comped subscription and company for an admin-created
 * Founder org. Safe to run twice: if the org already has a company it only makes sure
 * the founder is linked.
 */
export async function provisionDemoFounder(
  admin: SupabaseClient,
  org: Pick<Organization, "id" | "name" | "tier" | "type">,
): Promise<DemoFounderResult> {
  if (org.type !== "founder") {
    throw new Error("Only Founder accounts have a founder login.");
  }

  const { data: existing } = await loose(admin)
    .from("companies")
    .select("id, founder_id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const found = existing as { id: string; founder_id: string | null } | null;
  if (found?.founder_id) {
    await linkFounderToOrg(admin, found.founder_id, org.id);
    return { founderId: found.founder_id, companyId: found.id, created: false };
  }

  const plan = demoPlanForTier(org.tier);
  const email = demoFounderEmail(org.id);
  const createdUser = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: org.name, role: "founder", requested_plan: plan },
  });
  const founderId = (createdUser.data?.user as { id: string } | null | undefined)?.id;
  if (createdUser.error || !founderId) {
    throw new Error(`Could not create the founder login: ${createdUser.error?.message ?? "unknown error"}`);
  }

  // The comped plan is written first so onboarding finds it and never creates the
  // default "Basic, awaiting payment" row that would lock the founder screens.
  const now = new Date().toISOString();
  const { error: subError } = await loose(admin).from("subscriptions").upsert(
    {
      profile_id: founderId,
      role: "founder",
      plan_type: plan,
      subscription_status: "active",
      current_period_start: now,
      monthly_price_cents: 0,
      currency: "USD",
      is_grandfathered: false,
      updated_at: now,
    },
    { onConflict: "profile_id" },
  );
  if (subError) throw new Error(`Could not set the comped plan: ${subError.message}`);

  const onboarding = await ensureUserOnboarding({
    userId: founderId,
    email,
    fullName: org.name,
    role: "founder",
    requestedPlan: plan,
  });
  const company = onboarding.company;
  if (!company) throw new Error("Could not create the founder company.");

  const { error: companyError } = await loose(admin)
    .from("companies")
    .update({ org_id: org.id })
    .eq("id", company.id);
  if (companyError) throw new Error(`Could not link the company to the account: ${companyError.message}`);

  await linkFounderToOrg(admin, founderId, org.id);
  return { founderId, companyId: company.id, created: true };
}
