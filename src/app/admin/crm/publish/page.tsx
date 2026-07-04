import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listPublishItems } from "@/lib/publish/store";
import { getAudienceStats } from "@/lib/approach/store";
import { PublishClient } from "./PublishClient";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [items, stats] = await Promise.all([listPublishItems(), getAudienceStats()]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Private Market · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Publish</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Draft a message to a segment. It passes the compliance lint before it can queue, and nothing sends until an admin approves it — no automatic outbound.
          </p>
        </div>
        <PublishClient items={items} segmentSizes={{ hot: stats.hot, warm: stats.warm, cold: stats.cold }} canApprove={profile.role === "admin"} />
      </div>
    </AppShell>
  );
}
