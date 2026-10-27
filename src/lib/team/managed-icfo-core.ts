import { INTERNAL_ROLE_RANK, isInternalRoleSlug } from "@/lib/rbac/constants";

/**
 * Managed by iCFO: the iCFO team operates a Premium, Done for you account.
 * No access to billing (see billing-access). Pure rules only, so they can be
 * unit tested without a database.
 */
export const MANAGED_ICFO_ROLE = "managed_icfo";

/** Who may add a Managed by iCFO user: the account Owner, or an existing Managed by iCFO user. */
export function canGrantManagedIcfo(callerRole: string | null | undefined): boolean {
  return callerRole === "owner" || callerRole === MANAGED_ICFO_ROLE;
}

/** Managed by iCFO exists only on an active Premium, Done for you plan. */
export function isManagedIcfoPlan(planType: string | null | undefined, status: string | null | undefined): boolean {
  return planType === "founder_premium" && status === "active";
}

/**
 * Who may accept a Managed by iCFO invite: iCFO staff with the Manager role or
 * higher, a Super Admin, or a legacy staff Admin profile with no role row.
 * Founders, investors, analysts and regular users cannot.
 */
export function isIcfoManagerOrAdmin(input: {
  profileRole: string | null | undefined;
  roleSlug: string | null | undefined;
  isSuperAdmin: boolean;
}): boolean {
  if (input.isSuperAdmin) return true;
  const profileRole = (input.profileRole ?? "").toLowerCase();
  if (profileRole !== "admin" && profileRole !== "analyst") return false;
  if (profileRole === "admin") return true;
  const slug = input.roleSlug ?? "";
  return isInternalRoleSlug(slug) && INTERNAL_ROLE_RANK[slug] >= INTERNAL_ROLE_RANK.manager;
}
