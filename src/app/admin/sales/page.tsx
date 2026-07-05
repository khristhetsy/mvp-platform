import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "./SalesHubHeader";

export const dynamic = "force-dynamic";

export default async function SalesDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "36px 24px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
        Sales dashboard — clickable widgets and the AI Sales advisor land here next. For now, start in <b>Contacts</b> to see your founders.
      </div>
    </AppShell>
  );
}
