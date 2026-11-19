import type { SupabaseClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllOrganizations } from "@/lib/organizations/organizations";
import { AdminAccountsClient } from "@/components/admin/AdminAccountsClient";
import { getActingCapability } from "@/lib/admin/act-on-behalf";
import { loadConversions } from "@/lib/organizations/convert-to-paid";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  // Any admin/analyst staff (incl. Sales) can view AND create demo/internal
  // accounts here — no per-person permission grant required.
  const profile = await requireRole(["admin", "analyst"]);
  const canManage = true;
  const admin = createServiceRoleClient();
  const orgs = await listAllOrganizations(admin).catch(() => []);

  // The founder behind each account, so a demo row can offer "Open as". Only accounts
  // that have a company linked to them appear here.
  const founders: Record<string, { id: string; name: string }> = {};
  if (orgs.length) {
    // org_id is not in the hand-maintained types yet, so the client is read loosely.
    const { data: rows } = await (admin as unknown as SupabaseClient)
      .from("companies")
      .select("org_id, founder_id")
      .in("org_id", orgs.map((o) => o.id));
    for (const r of (rows ?? []) as Array<{ org_id: string | null; founder_id: string | null }>) {
      const org = orgs.find((o) => o.id === r.org_id);
      if (org && r.founder_id && !founders[org.id]) founders[org.id] = { id: r.founder_id, name: org.name };
    }
  }
  const acting = await getActingCapability();
  const canOpenAs = acting.available && acting.hasPermission;

  // Checkout links already sent to convert a demo to paid, and who may send one. Billing is admin only.
  const conversions = await loadConversions(admin);
  const canConvert = String(profile.role).toLowerCase() === "admin";

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Admin account"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Accounts"
          title="Account registry"
          description="Every account — Founder and Deal Company — with live billing status. Create demo or internal accounts directly (comped, email dispatch off)."
        />
        <AdminAccountsClient initialOrgs={orgs} canManage={canManage} founders={founders} canOpenAs={canOpenAs} conversions={conversions} canConvert={canConvert} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
