import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AccountActivityAlerts } from "@/components/admin/activity/AccountActivityAlerts";
import { requireRole } from "@/lib/supabase/auth";
import { loadStageAssignments } from "@/lib/activity/assignments";

export const dynamic = "force-dynamic";

export default async function AccountActivityAlertsPage() {
  await requireRole(["admin", "analyst"]);
  const assignments = await loadStageAssignments();

  return (
    <AppShell>
      <div className="space-y-4">
        <Link href="/admin/activity" className="text-xs text-indigo-600 hover:underline">
          ← Account activity
        </Link>
        <AccountActivityAlerts assignments={assignments} />
      </div>
    </AppShell>
  );
}
