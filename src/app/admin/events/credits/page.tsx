import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CREDITS_ENABLED, listCatalog, listRedemptions } from "@/lib/icfo-events/credits";
import { CreditsCatalogManager } from "@/components/admin-events/CreditsCatalogManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "iCFO Points — catalog" };

export default async function AdminCreditsPage() {
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const [items, redemptions] = await Promise.all([
    listCatalog(admin, false).catch(() => []),
    listRedemptions(admin, 50).catch(() => []),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="iCFO Points"
    >
      <div className="mx-auto max-w-3xl px-1 py-2">
        <h1 className="text-xl font-semibold text-[var(--navy)]">iCFO Points</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Closed-loop rewards earned 1:1 from gamification participation and redeemed for the services below.
        </p>
        <div className="mt-6">
          <CreditsCatalogManager initialItems={items} redemptions={redemptions} enabled={CREDITS_ENABLED} />
        </div>
      </div>
    </AppShell>
  );
}
