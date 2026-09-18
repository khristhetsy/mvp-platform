import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../IrHubTabs";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Odoo import" };

export default async function IrImportPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <ImportClient meId={profile.id} />
    </AppShell>
  );
}
