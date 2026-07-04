import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getClassifyStats, getReviewQueue } from "@/lib/classify/store";
import { ClassifyClient } from "./ClassifyClient";

export const dynamic = "force-dynamic";

export default async function ClassifyPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [stats, queue] = await Promise.all([getClassifyStats(), getReviewQueue(50)]);

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
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Classify contacts</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Resolve each contact to a founder or investor side. Clear signals are assigned automatically; ambiguous ones wait here for a one-click decision — never guessed.
          </p>
        </div>
        <ClassifyClient stats={stats} initialQueue={queue} />
      </div>
    </AppShell>
  );
}
