import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../IrHubTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Tasks</p>
        <p className="mt-1">Weekly batch board (four week columns per month, investor chips, task form with Agent field and in-context matching queue) is the next phase. Until then, matches are added from the pipeline&rsquo;s Add matches button.</p>
        <Link href={`/admin/ir/projects/${id}`} className="mt-3 inline-block text-indigo-700 hover:underline">← Back to the pipeline</Link>
      </div>
    </AppShell>
  );
}
