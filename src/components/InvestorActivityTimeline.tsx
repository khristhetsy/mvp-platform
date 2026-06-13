import { listInvestorOwnCrmActivityForAuthenticatedInvestor, type InvestorActivityRow } from "@/lib/data/investor-crm";
import { resolveInvestorIdFromSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvestorActivityTimelineClient } from "@/components/InvestorActivityTimelineClient";

export function InvestorActivityTimelineSkeleton() {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(12,35,64,.06)", padding: 24 }}>
      <div style={{ width: 140, height: 16, background: "#f1f5f9", borderRadius: 6, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ width: 200, height: 12, background: "#f8fafc", borderRadius: 6, marginBottom: 24 }} />
      {[0, 1, 2].map((k) => (
        <div key={k} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 100, height: 11, background: "#f1f5f9", borderRadius: 4, marginBottom: 6 }} />
            <div style={{ width: 160, height: 13, background: "#f8fafc", borderRadius: 4, marginBottom: 4 }} />
            <div style={{ width: 80, height: 10, background: "#f8fafc", borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InvestorActivityTimeline({
  activities,
  error,
}: {
  activities: InvestorActivityRow[];
  error?: string | null;
}) {
  return <InvestorActivityTimelineClient activities={activities} error={error} />;
}

export async function InvestorActivityTimelineSection() {
  const supabase = await createServerSupabaseClient();
  const investorId = await resolveInvestorIdFromSession(supabase);

  if (!investorId) {
    return <InvestorActivityTimeline activities={[]} error="Authentication required." />;
  }

  const { rows, error } = await listInvestorOwnCrmActivityForAuthenticatedInvestor(investorId);

  return <InvestorActivityTimeline activities={rows} error={error} />;
}
