import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { roleCanManageBilling } from "@/lib/billing/billing-access-core";
import { isActingAsFounder } from "@/lib/admin/acting-central";
import type { Profile } from "@/lib/supabase/types";

export const BILLING_OWNER_ONLY_MESSAGE = "Billing is managed by the account Owner.";

/**
 * True when this person may see or change billing for the account they are
 * working in. Fails closed: if the role cannot be read, billing stays hidden.
 */
export async function canManageBilling(profileId: string): Promise<boolean> {
  try {
    const admin = createServiceRoleClient();
    const { data: profile } = await admin.from("profiles").select("*").eq("id", profileId).maybeSingle();
    if (!profile) return false;
    // Billing routes already limit plan changes to founder accounts; staff are not company members.
    if (String(profile.role).toLowerCase() !== "founder") return true;
    // Staff acting as this founder never get billing, even though they run as the Owner.
    if (await isActingAsFounder()) return false;

    const { company } = await getActiveCompanyForUser(profile as unknown as Profile);
    if (!company) return true;

    const { data, error } = await admin
      .from("company_members")
      .select("role")
      .eq("company_id", company.id)
      .eq("user_id", profileId)
      .maybeSingle();
    if (error) {
      console.error("[billing-access] membership lookup failed", error.message);
      return false;
    }
    return roleCanManageBilling(data?.role);
  } catch (err) {
    console.error("[billing-access] check failed", err);
    return false;
  }
}

/** A 403 response when billing is closed to this person, otherwise null. */
export async function billingOwnerOnlyResponse(profileId: string): Promise<NextResponse | null> {
  if (await canManageBilling(profileId)) return null;
  return NextResponse.json({ error: BILLING_OWNER_ONLY_MESSAGE }, { status: 403 });
}
