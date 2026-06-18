import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ACCENT = "#534AB7";

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
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "#EEEDFE", margin: "0 auto 16px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke={ACCENT} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="17 21 17 13 7 13 7 21" stroke={ACCENT} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 3 7 8 15 8" stroke={ACCENT} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>No deal rooms yet</p>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, maxWidth: 380, margin: "0 auto 20px" }}>
                Deal rooms open automatically when you express interest in a company and the founder enables structured diligence. Browse opportunities to get started.
              </p>
              <Link
                href="/investor/opportunities"
                style={{
                  display: "inline-block", background: ACCENT, color: "white",
                  fontSize: 13, fontWeight: 600, padding: "9px 22px",
                  borderRadius: 10, textDecoration: "none",
                }}
              >
                Browse opportunities →
              </Link>
            </div>
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
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
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

