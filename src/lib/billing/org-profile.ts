// Org billing profile — the company's own billing identity (company, billing contact,
// address). Single fixed-id row; editable by staff. Payment methods are never stored here
// (that stays on the Lemon Squeezy hosted form).
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface OrgBillingProfile { company: string | null; billing_contact: string | null; address: string | null; updated_at: string | null }

export async function getOrgBillingProfile(): Promise<OrgBillingProfile> {
  const { data } = await db().from("org_billing_profile").select("company, billing_contact, address, updated_at").eq("id", "default").maybeSingle();
  return {
    company: data?.company ?? null,
    billing_contact: data?.billing_contact ?? null,
    address: data?.address ?? null,
    updated_at: data?.updated_at ?? null,
  };
}

export async function updateOrgBillingProfile(patch: { company?: string | null; billing_contact?: string | null; address?: string | null }, updatedBy: string): Promise<void> {
  const update: Record<string, unknown> = { id: "default", updated_by: updatedBy, updated_at: new Date().toISOString() };
  if (patch.company !== undefined) update.company = patch.company;
  if (patch.billing_contact !== undefined) update.billing_contact = patch.billing_contact;
  if (patch.address !== undefined) update.address = patch.address;
  const { error } = await db().from("org_billing_profile").upsert(update, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
