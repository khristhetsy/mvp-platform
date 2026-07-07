// Department access resolver. Wraps the get_user_features RPC. Resilient by design:
// if the RPC errors (e.g. migration not applied yet) it FAILS OPEN — returns full
// access — so existing admins/analysts keep working until grants are configured.
// Once the tables exist, real fail-closed department scoping applies to non-admins.

import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface UserFeature {
  key: string;
  label: string;
  hubKey: string;
  path: string;
  sortOrder: number;
}

export interface UserAccess {
  isAdmin: boolean;      // admin department or legacy platform-admin → full access
  unrestricted: boolean; // true when access could not be resolved (fail-open) or isAdmin
  features: UserFeature[];
  paths: string[];
  hubs: string[];
}

const FULL_ACCESS: UserAccess = { isAdmin: true, unrestricted: true, features: [], paths: [], hubs: [] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export async function loadUserAccess(userId: string): Promise<UserAccess> {
  try {
    const { data: mem } = await db().from("department_members").select("department_id").eq("user_id", userId);
    const memberships = (mem ?? []).map((m: { department_id: string }) => m.department_id);

    // Bypass is the ADMIN DEPARTMENT (not a role). Membership is the source of truth.
    let inAdminDept = false;
    if (memberships.length) {
      const { data: adminDepts } = await db().from("departments").select("id").eq("is_admin", true).in("id", memberships);
      inAdminDept = (adminDepts ?? []).length > 0;
    }

    // Rollout-safe rule: admin-department members and *unassigned* internal users
    // are unrestricted. Anyone assigned to a non-admin department is scoped.
    if (inAdminDept || memberships.length === 0) {
      return { isAdmin: inAdminDept, unrestricted: true, features: [], paths: [], hubs: [] };
    }

    const { data, error } = await db().rpc("get_user_features", { p_user_id: userId });
    if (error) return FULL_ACCESS; // migration not applied → don't restrict yet
    const features: UserFeature[] = ((data ?? []) as Array<{ feature_key: string; label: string; hub_key: string; path: string; sort_order: number }>)
      .map((r) => ({ key: r.feature_key, label: r.label, hubKey: r.hub_key, path: r.path, sortOrder: r.sort_order }));
    return {
      isAdmin: false,
      unrestricted: false,
      features,
      paths: [...new Set(features.map((f) => f.path))],
      hubs: [...new Set(features.map((f) => f.hubKey))],
    };
  } catch {
    return FULL_ACCESS;
  }
}

/**
 * Does an allowed path set grant access to a requested pathname?
 * Longest-prefix match. `/admin` (dashboard) matches only exactly, so it never
 * acts as a catch-all for unregistered deeper routes.
 */
export function pathAllowed(requested: string, allowedPaths: string[]): boolean {
  const matches = allowedPaths.filter((p) => (p === "/admin" ? requested === "/admin" : requested === p || requested.startsWith(p + "/")));
  return matches.length > 0;
}

/** The registered feature path that best matches a route (longest prefix), or null. */
export function matchFeaturePath(requested: string, featurePaths: string[]): string | null {
  const matches = featurePaths
    .filter((p) => (p === "/admin" ? requested === "/admin" : requested === p || requested.startsWith(p + "/")))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}
