import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StageAssignmentClient } from "@/components/admin/activity/StageAssignmentClient";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { loadStageAssignments } from "@/lib/activity/assignments";

export const dynamic = "force-dynamic";

export default async function StageAssignmentPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = await createServerSupabaseClient();

  const [board, { permissions }] = await Promise.all([
    loadStageAssignments(),
    getEffectivePermissions(supabase, profile.id, profile),
  ]);

  // Read-only for staff without the settings permission rather than hidden —
  // knowing who is accountable for a stage is useful to everyone; changing it
  // is not.
  const canEdit = permissions.includes("manage_settings");

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/activity" className="text-xs text-indigo-600 hover:underline">
            ← Account activity
          </Link>
          {!canEdit && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Read only
            </span>
          )}
        </div>
        <StageAssignmentClient initial={board} canEdit={canEdit} />
      </div>
    </AppShell>
  );
}
