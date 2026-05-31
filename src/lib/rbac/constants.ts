export const INTERNAL_ROLE_SLUGS = ["regular_user", "manager", "admin", "super_admin"] as const;

export type InternalRoleSlug = (typeof INTERNAL_ROLE_SLUGS)[number];

export const INTERNAL_PERMISSIONS = [
  "view_admin_dashboard",
  "manage_companies",
  "manage_investors",
  "review_documents",
  "approve_marketplace",
  "manage_learning",
  "manage_page_builder",
  "manage_users",
  "assign_roles",
  "view_audit_logs",
  "manage_settings",
] as const;

export type InternalPermission = (typeof INTERNAL_PERMISSIONS)[number];

export const INTERNAL_PERMISSION_LABELS: Record<InternalPermission, string> = {
  view_admin_dashboard: "View Admin Dashboard",
  manage_companies: "Manage Companies",
  manage_investors: "Manage Investors",
  review_documents: "Review Documents",
  approve_marketplace: "Approve Marketplace",
  manage_learning: "Manage Learning",
  manage_page_builder: "Manage Page Builder",
  manage_users: "Manage Users",
  assign_roles: "Assign Roles",
  view_audit_logs: "View Audit Logs",
  manage_settings: "Manage Settings",
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

/** Permissions granted to legacy staff (admin/analyst) without an RBAC row. */
export const LEGACY_STAFF_PERMISSIONS: InternalPermission[] = INTERNAL_PERMISSIONS.filter(
  (p) => p !== "manage_users" && p !== "assign_roles" && p !== "manage_page_builder",
);

export const SUPER_ADMIN_ONLY_PERMISSIONS: InternalPermission[] = [
  "manage_users",
  "assign_roles",
  "manage_page_builder",
];

export function isInternalPermission(value: string): value is InternalPermission {
  return (INTERNAL_PERMISSIONS as readonly string[]).includes(value);
}

export function isInternalRoleSlug(value: string): value is InternalRoleSlug {
  return (INTERNAL_ROLE_SLUGS as readonly string[]).includes(value);
}
