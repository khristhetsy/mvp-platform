import type { InternalPermission } from "@/lib/rbac/constants";
import { INTERNAL_PERMISSION_LABELS } from "@/lib/rbac/constants";

/**
 * Registry that maps each admin-dashboard card/section to the RBAC permissions a
 * user must hold to (a) SEE it and (b) ACT on its inline controls. This is the
 * single source of truth linking the dashboard to the existing User Permissions
 * screen (/admin/users/permissions):
 *   - revoke the `view` permission  → the card disappears (hide-on-revoke)
 *   - revoke the `act` permission    → the card stays visible but read-only
 *
 * `view: null`  → core card every staff member sees (baseline access).
 * `act: null`   → nothing to act on inline (navigation/informational card);
 *                 its destination pages enforce their own permissions.
 */

export type DashboardCardId =
  | "platform_health"
  | "next_best_actions"
  | "upcoming_meetings"
  | "operations_control"
  | "kpi_grid"
  | "orchestration_visibility"
  | "activity_graph"
  | "investor_activity"
  | "recent_activity"
  | "platform_overview"
  | "system_health";

export interface DashboardCardDef {
  id: DashboardCardId;
  /** Human label (used in the "requires X access" note and admin tooling). */
  label: string;
  /** Permission required to render the card, or null for core cards. */
  view: InternalPermission | null;
  /** Permission required to use inline action controls, or null if none. */
  act: InternalPermission | null;
}

export const DASHBOARD_CARDS: DashboardCardDef[] = [
  { id: "platform_health", label: "Platform health", view: "view_system_health", act: null },
  { id: "next_best_actions", label: "Operational priorities", view: "view_actions", act: "manage_actions" },
  { id: "upcoming_meetings", label: "Upcoming meetings", view: null, act: null },
  { id: "operations_control", label: "Operations control (queues)", view: "manage_queues", act: null },
  { id: "kpi_grid", label: "Platform KPIs", view: null, act: null },
  { id: "orchestration_visibility", label: "Automation & orchestration", view: "manage_automation", act: null },
  { id: "activity_graph", label: "Platform activity graph", view: "view_analytics", act: null },
  { id: "investor_activity", label: "Investor activity", view: "manage_investors", act: null },
  { id: "recent_activity", label: "Recent activity timeline", view: null, act: null },
  { id: "platform_overview", label: "Company portfolio overview", view: "manage_companies", act: null },
  { id: "system_health", label: "System health", view: "view_system_health", act: null },
];

const CARD_BY_ID = new Map(DASHBOARD_CARDS.map((c) => [c.id, c]));

/** Permission required to VIEW a card, or null if it's a core (always-visible) card. */
export function cardViewPermission(id: DashboardCardId): InternalPermission | null {
  return CARD_BY_ID.get(id)?.view ?? null;
}

/** Permission required to ACT on a card's inline controls, or null if it has none. */
export function cardActPermission(id: DashboardCardId): InternalPermission | null {
  return CARD_BY_ID.get(id)?.act ?? null;
}

/**
 * True if a user holding `permissions` may SEE the given card. Core cards
 * (view === null) are always visible. Super admins should be passed the full
 * permission set (getEffectivePermissions already does this).
 */
export function canSeeCard(id: DashboardCardId, permissions: readonly InternalPermission[]): boolean {
  const required = cardViewPermission(id);
  if (!required) return true;
  return permissions.includes(required);
}

/**
 * True if a user holding `permissions` may ACT on the given card's inline
 * controls. Cards with no act permission (act === null) always return true —
 * there's nothing extra to gate. A user who can see but not act gets a
 * read-only card.
 */
export function canActOnCard(id: DashboardCardId, permissions: readonly InternalPermission[]): boolean {
  const required = cardActPermission(id);
  if (!required) return true;
  return permissions.includes(required);
}

/** Label of the permission a card needs to be viewed, for "requires X access" copy. */
export function cardViewPermissionLabel(id: DashboardCardId): string | null {
  const required = cardViewPermission(id);
  return required ? INTERNAL_PERMISSION_LABELS[required] : null;
}
