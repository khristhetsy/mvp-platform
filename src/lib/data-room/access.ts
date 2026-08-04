// Data-room access grants: grant / revoke / list, and the active-grant check
// used to enforce document access. The `data_room_access` table is not in the
// generated Supabase types yet, so queries go through a loosely-typed client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type DataRoomScope = "full" | "financials";

export interface DataRoomGrant {
  id: string;
  investorId: string;
  scope: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  investorName: string | null;
  investorEmail: string | null;
  active: boolean;
}

type GrantRow = {
  id: string;
  investor_id: string;
  scope: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

function loose(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function isActive(expiresAt: string | null, revokedAt: string | null): boolean {
  if (revokedAt) return false;
  return !expiresAt || new Date(expiresAt) > new Date();
}

export async function grantDataRoomAccess(input: {
  companyId: string;
  investorId: string;
  scope?: DataRoomScope;
  expiresAt?: string | null;
  grantedBy: string;
}): Promise<void> {
  const { error } = await loose()
    .from("data_room_access")
    .upsert(
      {
        company_id: input.companyId,
        investor_id: input.investorId,
        scope: input.scope ?? "full",
        expires_at: input.expiresAt ?? null,
        revoked_at: null,
        granted_by: input.grantedBy,
      },
      { onConflict: "company_id,investor_id" },
    );
  if (error) throw new Error(`Failed to grant data-room access: ${error.message}`);
}

export async function revokeDataRoomAccess(companyId: string, investorId: string): Promise<void> {
  const { error } = await loose()
    .from("data_room_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("investor_id", investorId);
  if (error) throw new Error(`Failed to revoke data-room access: ${error.message}`);
}

export async function listDataRoomAccess(companyId: string): Promise<DataRoomGrant[]> {
  const { data, error } = await loose()
    .from("data_room_access")
    .select("id, investor_id, scope, expires_at, revoked_at, created_at, profiles:investor_id(full_name, email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list data-room access: ${error.message}`);
  return ((data ?? []) as unknown as GrantRow[]).map((r) => ({
    id: r.id,
    investorId: r.investor_id,
    scope: r.scope,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
    investorName: r.profiles?.full_name ?? null,
    investorEmail: r.profiles?.email ?? null,
    active: isActive(r.expires_at, r.revoked_at),
  }));
}

/** True if the investor holds an active (non-revoked, non-expired) grant. */
export async function investorHasActiveDataRoomGrant(
  supabase: SupabaseClient,
  investorId: string,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("data_room_access")
    .select("expires_at, revoked_at")
    .eq("company_id", companyId)
    .eq("investor_id", investorId)
    .is("revoked_at", null)
    .maybeSingle();
  const row = data as { expires_at: string | null; revoked_at: string | null } | null;
  return Boolean(row) && isActive(row!.expires_at, row!.revoked_at);
}
