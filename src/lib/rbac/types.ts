import type { InternalPermission, InternalRoleSlug } from "@/lib/rbac/constants";

export type InternalRoleRow = {
  id: string;
  slug: InternalRoleSlug;
  label: string;
  description: string | null;
  rank: number;
  is_active: boolean;
  created_at: string;
};

export type InternalPermissionRow = {
  id: string;
  slug: InternalPermission;
  label: string;
  description: string | null;
  created_at: string;
};

export type InternalUserRoleRow = {
  user_id: string;
  role_id: string;
  is_active: boolean;
  assigned_at: string;
  assigned_by: string | null;
};

export type InternalPermissionOverrideRow = {
  user_id: string;
  permission_id: string;
  granted: boolean;
  created_at: string;
  created_by: string | null;
};

export type EffectivePermissionsResult = {
  permissions: InternalPermission[];
  roleSlug: InternalRoleSlug | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  legacyFallback: boolean;
};

export type InternalUserSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  profileRole: string;
  isSuperAdmin: boolean;
  roleSlug: InternalRoleSlug | null;
  roleLabel: string | null;
  isActive: boolean;
  effectivePermissions: InternalPermission[];
  overrides: Array<{ permission: InternalPermission; granted: boolean }>;
};
