import "server-only";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";

/** The signed in admin and whether they may release sequence sends (manage_actions or super admin). */
export async function sequenceSender(): Promise<{ profile: Profile; canApprove: boolean } | null> {
  const profile = (await requireRole(["admin", "analyst"]).catch(() => null)) as (Profile & { is_super_admin?: boolean }) | null;
  if (!profile) return null;
  const effective = await getEffectivePermissions(createServiceRoleClient(), profile.id, profile);
  return { profile, canApprove: effective.isSuperAdmin || effective.permissions.includes("manage_actions") };
}
