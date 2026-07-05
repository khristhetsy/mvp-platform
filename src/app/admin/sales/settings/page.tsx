import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";

export const dynamic = "force-dynamic";

export default async function SalesSettingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "36px 24px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
        Settings — task types &amp; assignment (reusing the tasks engine) and reminder notifications. Building last.
      </div>
    </AppShell>
  );
}
