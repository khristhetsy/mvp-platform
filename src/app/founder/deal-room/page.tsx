import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export const dynamic = "force-dynamic";

export default async function FounderDealRoomIndexPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const { data: rooms } = company
    ? await supabase
        .from("deal_rooms")
        .select("id, title, status, updated_at, created_at")
        .eq("company_id", company.id)
        .order("updated_at", { ascending: false })
        .limit(200)
    : { data: [] as Array<{ id: string; title: string; status: string; updated_at: string; created_at: string }> };

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? "Your company"}>
      <FounderFeatureGate featureKey="investor_access">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Deal room"
            title="Investor deal rooms"
            description="Structured diligence collaboration. No public access. No legal or investment advice."
            metadata={`${(rooms ?? []).length} rooms`}
          />

          <WorkspacePanel title="Rooms" subtitle="Your company deal rooms">
            {(rooms ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No deal rooms yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(rooms ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{r.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        status: {r.status} · updated {new Date(String(r.updated_at)).toLocaleDateString("en-US")}
                      </p>
                    </div>
                    <Link href={`/founder/deal-room/${r.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}

