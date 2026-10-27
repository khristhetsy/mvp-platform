/**
 * Who may see or change billing: the account Owner only.
 *
 * A missing role means the person has no membership row on the active company
 * (the founder who created it, or a staff account). They are allowed, because
 * every billing record is keyed to their own profile.
 * Any other role (admin, member, managed_icfo) is blocked.
 */
export function roleCanManageBilling(role: string | null | undefined): boolean {
  if (role === null || role === undefined || role.trim() === "") return true;
  return role.trim().toLowerCase() === "owner";
}
