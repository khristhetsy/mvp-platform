import type { SupabaseClient } from "@supabase/supabase-js";

// Shared model for the multi-account / Deal Company feature. See
// icapos-multi-account-build-spec.md. The DB enum value 'spv' is a backend/legal
// term only — the UI must always render it via TYPE_LABEL as "Deal Company".

export type OrgType = "founder" | "spv";
export type OrgBillingStatus = "incomplete" | "active" | "past_due" | "canceled" | "comped";
export type OrgCreatedVia = "signup" | "admin_direct";
export type OrgPurpose = "demo" | "internal" | null;
export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export type Organization = {
  id: string;
  name: string;
  type: OrgType;
  parent_org_id: string | null;
  billing_status: OrgBillingStatus;
  tier: "basic" | "professional" | null;
  created_via: OrgCreatedVia;
  purpose: OrgPurpose;
  email_dispatch_enabled: boolean;
  created_by: string | null;
  created_at: string;
};

/** Single source of truth for how each org type is shown. Never print the raw
 *  enum — always map through this (spec §6). */
export const TYPE_LABEL: Record<OrgType, string> = {
  founder: "Founder",
  spv: "Deal Company",
};

export const BILLING_LABEL: Record<OrgBillingStatus, string> = {
  incomplete: "Incomplete",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  comped: "Comped",
};

export function typeLabel(type: OrgType): string {
  return TYPE_LABEL[type] ?? type;
}

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

const ORG_COLUMNS =
  "id,name,type,parent_org_id,billing_status,tier,created_via,purpose,email_dispatch_enabled,created_by,created_at";

/** The organizations the current user is a member of (their account switcher). */
export async function listMyOrganizations(supabase: unknown, userId: string): Promise<Organization[]> {
  const { data: mems } = await loose(supabase)
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId);
  const ids = (mems ?? []).map((m: { org_id: string }) => m.org_id);
  if (!ids.length) return [];
  const { data } = await loose(supabase)
    .from("organizations")
    .select(ORG_COLUMNS)
    .in("id", ids)
    .order("created_at", { ascending: true });
  return (data ?? []) as Organization[];
}

/** Admin registry — every org regardless of billing status (spec §5, §3a). */
export async function listAllOrganizations(admin: unknown): Promise<Organization[]> {
  const { data } = await loose(admin)
    .from("organizations")
    .select(ORG_COLUMNS)
    .order("created_at", { ascending: false });
  return (data ?? []) as Organization[];
}

export async function getOrganization(admin: unknown, orgId: string): Promise<Organization | null> {
  const { data } = await loose(admin)
    .from("organizations")
    .select(ORG_COLUMNS)
    .eq("id", orgId)
    .maybeSingle();
  return (data as Organization | null) ?? null;
}

/** Server-side guard: is this user a member of the org? Used to validate an
 *  active-org cookie on every switch (spec §7 step 5). */
export async function isOrgMember(supabase: unknown, userId: string, orgId: string): Promise<boolean> {
  const { data } = await loose(supabase)
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}
