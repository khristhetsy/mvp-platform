import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getAudienceStats, getHotQueue } from "@/lib/approach/store";
import { AudienceClient } from "./AudienceClient";

export const dynamic = "force-dynamic";

export default async function AudiencePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [stats, hot] = await Promise.all([getAudienceStats(), getHotQueue(50)]);

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
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Audience &amp; approach</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Score how — and whether — to approach each classified contact. Founders score on readiness gaps; investors on thesis fit. Hot leads rise to the top.
          </p>
        </div>
        <AudienceClient stats={stats} initialHot={hot} />
      </div>
    </AppShell>
  );
}
