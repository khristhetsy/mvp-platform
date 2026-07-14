import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";
import { SalesContactsClient } from "./SalesContactsClient";
import { getSalesScope } from "@/lib/sales/scope";
import { listAssignableStaff } from "@/lib/sales/settings";

export const dynamic = "force-dynamic";

export default async function SalesContactsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const scope = await getSalesScope(profile);
  const assignStaff = scope.isManager ? await listAssignableStaff() : [];
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <SalesContactsClient assignStaff={assignStaff} />
    </AppShell>
  );
}
