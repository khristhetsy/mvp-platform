import type { SupabaseClient } from "@supabase/supabase-js";
import { isManagedIcfoPlan } from "@/lib/team/managed-icfo-core";

/** Is the company Owner on an active Premium, Done for you plan right now? */
export async function ownerHasManagedIcfoPlan(client: unknown, companyId: string): Promise<boolean> {
  const admin = client as SupabaseClient;
  const { data: owner } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  let ownerId: string | null = owner?.user_id ?? null;
  if (!ownerId) {
    const { data: company } = await admin.from("companies").select("founder_id").eq("id", companyId).maybeSingle();
    ownerId = (company as { founder_id?: string | null } | null)?.founder_id ?? null;
  }
  if (!ownerId) return false;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_type, subscription_status")
    .eq("profile_id", ownerId)
    .maybeSingle();
  return isManagedIcfoPlan(sub?.plan_type, sub?.subscription_status);
}
