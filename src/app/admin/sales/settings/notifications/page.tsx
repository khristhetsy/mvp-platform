import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../../SalesHubHeader";
import { SettingsSubNav } from "../SettingsSubNav";
import { SettingsNotificationsClient } from "./SettingsNotificationsClient";

export const dynamic = "force-dynamic";

export default async function SalesSettingsNotificationsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <SettingsSubNav />
        <SettingsNotificationsClient />
      </div>
    </AppShell>
  );
}
