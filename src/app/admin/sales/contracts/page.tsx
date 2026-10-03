import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";
import { ContractsListClient } from "@/components/admin/contracts/ContractsListClient";

export const dynamic = "force-dynamic";

/** Sales Hub › Contracts: every SPV contract document as one pipeline view. */
export default async function SalesContractsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ContractsListClient />
    </AppShell>
  );
}
