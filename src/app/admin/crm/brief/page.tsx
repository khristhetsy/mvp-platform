import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { buildCmoBrief } from "@/lib/cmo/brief";
import { BriefClient } from "./BriefClient";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const brief = await buildCmoBrief();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Private Market · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Morning brief</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{brief.summary}</p>
          <p className="mt-1 text-xs text-slate-400">Advisory only — this brief never sends, posts, or calls. Turn any item into an Admin Task.</p>
        </div>
        <BriefClient items={brief.items} />
      </div>
    </AppShell>
  );
}
