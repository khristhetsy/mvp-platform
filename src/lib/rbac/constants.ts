export const INTERNAL_ROLE_SLUGS = ["regular_user", "manager", "admin", "super_admin"] as const;

export type InternalRoleSlug = (typeof INTERNAL_ROLE_SLUGS)[number];

export const INTERNAL_PERMISSIONS = [
  // Core
  "view_admin_dashboard",
  "view_actions",
  "manage_actions",
  // Operations
  "manage_companies",
  "manage_spvs",
  "manage_investors",
  "manage_deal_rooms",
  "manage_crm",
  "manage_matching",
  // Finance & compliance
  "manage_learning",
  "manage_billing",
  "manage_accounts",
  "manage_diligence",
  "manage_compliance",
  "view_audit_logs",
  "review_documents",
  // Platform tools
  "manage_integrations",
  "manage_queues",
  "manage_automation",
  "manage_reports",
  "manage_imports",
  "view_analytics",
  "view_insights",
  "view_system_health",
  "manage_beta_operations",
  "approve_marketplace",
  "view_events",
  "manage_events",
  // Admin only
  "manage_users",
  "assign_roles",
  "manage_settings",
  // Elevated — act as a founder (edit on their behalf) + service support
  "act_on_behalf",
] as const;

export type InternalPermission = (typeof INTERNAL_PERMISSIONS)[number];

export const INTERNAL_PERMISSION_LABELS: Record<InternalPermission, string> = {
  view_admin_dashboard: "View Admin Dashboard",
  view_actions: "View Actions",
  manage_actions: "Act on Operational Priorities",
  manage_companies: "Manage Companies",
  manage_spvs: "Manage SPVs",
  manage_investors: "Manage Investors",
  manage_deal_rooms: "Manage Deal Rooms",
  manage_crm: "Manage CRM",
  manage_matching: "Manage Matching",
  manage_learning: "Manage Learning",
  manage_billing: "Manage Billing",
  manage_accounts: "Manage Accounts (multi-account / Deal Company)",
  manage_diligence: "Manage Diligence",
  manage_compliance: "Manage Compliance",
  view_audit_logs: "View Audit Logs",
  review_documents: "Review Documents",
  manage_integrations: "Manage Integrations",
  manage_queues: "Manage Queues",
  manage_automation: "Manage Automation",
  manage_reports: "Manage Reports",
  manage_imports: "Manage Import / Export",
  view_analytics: "View Analytics",
  view_insights: "View Insights",
  view_system_health: "View System Health",
  manage_beta_operations: "Manage Beta Operations",
  approve_marketplace: "Approve Marketplace",
  view_events: "View Events",
  manage_events: "Manage Events",
  manage_users: "Manage Users",
  assign_roles: "Assign Roles",
  manage_settings: "Manage Settings",
  act_on_behalf: "Act on Behalf of a Founder",
};

export const INTERNAL_ROLE_LABELS: Record<InternalRoleSlug, string> = {
  regular_user: "Regular User",
  manager: "Manager",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const INTERNAL_ROLE_RANK: Record<InternalRoleSlug, number> = {
  regular_user: 10,
  manager: 20,
  admin: 30,
  super_admin: 40,
};

/** Permissions granted to legacy staff (admin/analyst) without an RBAC row.
 *  `act_on_behalf` is intentionally NOT auto-granted — it writes into a founder's
 *  own records, so it must be granted explicitly (or held by a super admin). */
export const LEGACY_STAFF_PERMISSIONS: InternalPermission[] = INTERNAL_PERMISSIONS.filter(
  (p) => p !== "manage_users" && p !== "assign_roles" && p !== "act_on_behalf",
);

export const SUPER_ADMIN_ONLY_PERMISSIONS: InternalPermission[] = [
  "manage_users",
  "assign_roles",
];

export function isInternalPermission(value: string): value is InternalPermission {
  return (INTERNAL_PERMISSIONS as readonly string[]).includes(value);
}

export function isInternalRoleSlug(value: string): value is InternalRoleSlug {
  return (INTERNAL_ROLE_SLUGS as readonly string[]).includes(value);
}
