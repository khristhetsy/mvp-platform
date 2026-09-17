import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../../IrHubTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Founder report" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Founder report</p>
        <p className="mt-1">The founder report (period picker, comparison, communications log, pipeline as of period end, send-as-PDF) lands with the dashboard phase.</p>
        <Link href={`/admin/ir/projects/${id}`} className="mt-3 inline-block text-indigo-700 hover:underline">← Back to the pipeline</Link>
      </div>
    </AppShell>
  );
}
