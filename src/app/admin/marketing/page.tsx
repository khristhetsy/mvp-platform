import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MarketingDashboardPage() {
  await requireRole(["admin"]);

  const supabase = await marketingDb();

  // Stats
  const [
    { count: totalContacts },
    { count: totalSent30d },
    campaigns,
  ] = await Promise.all([
    supabase.from("marketing_contacts").select("*", { count: "exact", head: true }),
    supabase
      .from("marketing_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "sent")
      .gte("occurred_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString()),
    supabase
      .from("marketing_campaigns")
      .select("id, name, status, stat_sent, stat_opened, stat_clicked")
      .in("status", ["sending", "sent", "live", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const { count: totalOpened } = await supabase
    .from("marketing_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "opened")
    .gte("occurred_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString());

  const openRate =
    totalSent30d && totalSent30d > 0
      ? ((totalOpened ?? 0) / totalSent30d) * 100
      : 0;

  const { count: totalReplies } = await supabase
    .from("marketing_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "replied")
    .gte("occurred_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString());

  // Funnel data
  const { count: delivered } = await supabase
    .from("marketing_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "delivered")
    .gte("occurred_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString());

  const { count: clicked } = await supabase
    .from("marketing_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "clicked")
    .gte("occurred_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString());

  const funnel = [
    { label: "Sent", value: totalSent30d ?? 0 },
    { label: "Delivered", value: delivered ?? 0 },
    { label: "Opened", value: totalOpened ?? 0 },
    { label: "Clicked", value: clicked ?? 0 },
    { label: "Replied", value: totalReplies ?? 0 },
  ];

  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div style={{ padding: "24px", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Marketing Dashboard</h1>
        <a
          href="/admin/marketing/campaigns"
          style={{
            background: "#534AB7",
            color: "#EEEDFE",
            padding: "7px 14px",
            borderRadius: 8,
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          + New campaign
        </a>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total contacts", value: (totalContacts ?? 0).toLocaleString() },
          { label: "Emails sent (30d)", value: (totalSent30d ?? 0).toLocaleString() },
          { label: "Avg open rate", value: `${openRate.toFixed(1)}%` },
          { label: "Replies (30d)", value: (totalReplies ?? 0).toLocaleString() },
        ].map((s) => (
          <div
            key={s.label}
            style={{ background: "var(--muted)", borderRadius: 8, padding: "12px 14px" }}
          >
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Active campaigns */}
        <div
          style={{
            background: "var(--background)",
            border: "0.5px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Active campaigns</div>
          {(campaigns.data ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No campaigns yet.</p>
          ) : (
            (campaigns.data ?? []).map((c: { id: string; name: string; status: string }) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 0",
                  borderBottom: "0.5px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span>{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
            ))
          )}
        </div>

        {/* Funnel */}
        <div
          style={{
            background: "var(--background)",
            border: "0.5px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Email funnel (30 days)</div>
          {funnel.map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 70 }}>{f.label}</div>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  background: "var(--muted)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(f.value / maxFunnel) * 100}%`,
                    background: "#534AB7",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, width: 40, textAlign: "right" }}>
                {f.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    live: { bg: "#EAF3DE", color: "#3B6D11" },
    sent: { bg: "#EAF3DE", color: "#3B6D11" },
    sending: { bg: "#EAF3DE", color: "#3B6D11" },
    scheduled: { bg: "#E6F1FB", color: "#185FA5" },
    paused: { bg: "#FAEEDA", color: "#854F0B" },
    draft: { bg: "#F1EFE8", color: "#5F5E5A" },
    cancelled: { bg: "#FCEBEB", color: "#A32D2D" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        fontWeight: 500,
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
