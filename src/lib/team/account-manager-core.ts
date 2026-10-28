/**
 * Premium account manager rules: pure, so they can be unit tested without a database.
 * One named iCFO owner per Premium account (single threaded ownership).
 */
export type AssignmentPlan =
  | { action: "skip"; reason: "already_assigned" }
  | { action: "needs_manager"; reason: "no_default" | "default_not_staff" }
  | { action: "assign"; managerId: string };

export function isStaffProfileRole(role: string | null | undefined): boolean {
  const r = (role ?? "").toLowerCase();
  return r === "admin" || r === "analyst";
}

/** What to do when an account starts paying for Premium. */
export function planPremiumAssignment(input: {
  existingManagerIds: string[];
  defaultManagerId: string | null;
  defaultIsStaff: boolean;
}): AssignmentPlan {
  if (input.existingManagerIds.length > 0) return { action: "skip", reason: "already_assigned" };
  if (!input.defaultManagerId) return { action: "needs_manager", reason: "no_default" };
  if (!input.defaultIsStaff) return { action: "needs_manager", reason: "default_not_staff" };
  return { action: "assign", managerId: input.defaultManagerId };
}

/** Moving an account to a new manager: everyone else loses managed access, the new one is added once. */
export function planReassignment(input: { existingManagerIds: string[]; newManagerId: string | null }): {
  remove: string[];
  add: boolean;
} {
  const keep = input.newManagerId;
  return {
    remove: input.existingManagerIds.filter((id) => id !== keep),
    add: Boolean(keep) && !input.existingManagerIds.includes(keep as string),
  };
}

/** May this staff member open the account as the founder from a list row? */
export function canOpenAsFounder(input: {
  available: boolean;
  hasPermission: boolean;
  staffId: string | null;
  managerId: string | null;
}): boolean {
  if (!input.available || !input.staffId) return false;
  return input.hasPermission || input.managerId === input.staffId;
}
