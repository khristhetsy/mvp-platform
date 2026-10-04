import { AppShell } from "@/components/AppShell";
import { WorkspaceHome } from "@/components/nav/WorkspaceHome";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * Admin home: the app grid (Odoo-style home screen). Admins land here after signing in.
 * Each tile opens its hub with the hub's regular menu; the Dashboard stays at /admin,
 * unchanged, and is the first tile.
 */
export default async function AdminHomePage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspaceHome workspace="admin" />
    </AppShell>
  );
}
