import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { SalesHubHeader } from "../SalesHubHeader";
import { SalesContactsClient } from "./SalesContactsClient";

export const dynamic = "force-dynamic";

export default async function SalesContactsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  // Assignment (owner + assignees) is managed in each contact's profile; mass Lead
  // assign here is super-admin only.
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <SalesContactsClient canBulkAssign={isSuperAdmin(profile)} />
    </AppShell>
  );
}
