import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InvestorDealRoomIndexPage() {
  const profile = await requireRole(["investor"]);
  const supabase = await createServerSupabaseClient();

  const { data: rooms } = await supabase
    .from("deal_rooms")
    .select("id, title, status, updated_at, created_at")
    .eq("investor_user_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Deal room"
          title="Founder deal rooms"
          description="Structured diligence collaboration. No public access. No funding commitment implied."
          metadata={`${(rooms ?? []).length} rooms`}
        />

        <WorkspacePanel title="Rooms" subtitle="Your investor deal rooms">
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
                  <Link
                    href={`/investor/deal-room/${r.id}`}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>
    </AppShell>
  );
}

