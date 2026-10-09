import { requireRole } from "@/lib/supabase/auth";
import { AccessClient, type AccessFounder, type UpgradeRequest } from "@/components/admin/investor-directory/AccessClient";
import { listUsage, loadSettings, loadTiers, upgradeRequests } from "@/lib/investor-directory/db";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function InvestorDirectoryAccessPage() {
  await requireRole(["admin"]);
  const settings = await loadSettings();
  const [tiers, usage, requests] = await Promise.all([loadTiers(), listUsage(settings), upgradeRequests()]);
  const ids = [...new Set(requests.map((r) => r.profile_id))];
  const { data: people } = ids.length
    ? await serviceRoleClientUntyped().from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const nameOf = new Map(((people ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name ?? p.email ?? "Founder"]));
  const founders: AccessFounder[] = usage.map((u) => ({
    founderId: u.founderId, name: u.name, company: u.company, held: u.held, status: u.status,
    tierKey: tiers.find((t) => t.label === u.tier)?.key ?? "free",
  }));
  const reqs: UpgradeRequest[] = requests.map((r) => ({
    id: r.id, profileId: r.profile_id, name: nameOf.get(r.profile_id) ?? "Founder", requestedTier: r.requested_plan ?? "", status: r.status, createdAt: r.created_at,
  }));
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Access</h1>
      <AccessClient tiers={tiers} settings={settings} founders={founders} requests={reqs} />
    </div>
  );
}
