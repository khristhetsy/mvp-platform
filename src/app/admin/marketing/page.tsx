import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import Link from "next/link";
import { MarketingStatCards } from "@/components/marketing/MarketingStatCards";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  sent:      { bg: "#E1F5EE", color: "#0F6E56", label: "Sent" },
  sending:   { bg: "#FAEEDA", color: "#854F0B", label: "Sending" },
  scheduled: { bg: "#E6F1FB", color: "#185FA5", label: "Scheduled" },
  paused:    { bg: "#FAEEDA", color: "#854F0B", label: "Paused" },
  draft:     { bg: "#F1EFE8", color: "#5F5E5A", label: "Draft" },
  cancelled: { bg: "#FCEBEB", color: "#A32D2D", label: "Cancelled" },
};

const SEQ_STATUS_MAP: Record<string, { bg: string; color: string }> = {
  active:   { bg: "#E1F5EE", color: "#0F6E56" },
  paused:   { bg: "#FAEEDA", color: "#854F0B" },
  draft:    { bg: "#F1EFE8", color: "#5F5E5A" },
  archived: { bg: "#FCEBEB", color: "#A32D2D" },
};

// Shared white card style
const card = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
} as React.CSSProperties;

export default async function MarketingDashboardPage() {
  await requireRole(["admin"]);
  const supabase = await marketingDb();
  // eslint-disable-next-line react-hooks/purity
  const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  // eslint-disable-next-line react-hooks/purity
  const since7d  = new Date(Date.now() - 7  * 86400 * 1000).toISOString();

  const [
    { count: totalContacts },
    { count: newContacts7d },
    { count: totalSent30d },
    { count: totalOpened30d },
    { count: totalClicked30d },
    campaigns,
    sequences,
  ] = await Promise.all([
    supabase.from("marketing_contacts").select("*", { count: "exact", head: true }),
    supabase.from("marketing_contacts").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "sent").gte("occurred_at", since30d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "opened").gte("occurred_at", since30d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "clicked").gte("occurred_at", since30d),
    supabase.from("marketing_campaigns")
      .select("id, name, status, stat_sent, stat_opened, stat_clicked, list:marketing_lists(name)")
      .in("status", ["sending", "sent", "scheduled", "paused"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("marketing_sequences")
      .select("id, name, status")
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const sent   = totalSent30d ?? 0;
  const opened = totalOpened30d ?? 0;
  const clicked = totalClicked30d ?? 0;
  const openRate  = sent > 0 ? (opened  / sent) * 100 : 0;
  const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;

  const statCardData = {
    totalContacts: totalContacts ?? 0,
    newContacts7d: newContacts7d ?? 0,
    sent,
    opened,
    clicked,
    openRate,
    clickRate,
    activeCampaigns: (campaigns.data ?? []).length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    campaigns: (campaigns.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      stat_sent: c.stat_sent,
      stat_opened: c.stat_opened,
      stat_clicked: c.stat_clicked,
    })),
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Overview</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Last 30 days</div>
        </div>
        <Link
          href="/admin/marketing/campaigns"
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#534AB7", color: "#EEEDFE", padding: "7px 14px", borderRadius: 8, fontSize: 12, textDecoration: "none", fontWeight: 500 }}
        >
          + New campaign
        </Link>
      </div>

      {/* Clickable stat cards */}
      <MarketingStatCards data={statCardData} />

      {/* Campaigns + Sequences */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Active campaigns */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active campaigns</span>
            <Link href="/admin/marketing/campaigns" style={{ fontSize: 12, color: "#534AB7", textDecoration: "none" }}>View all →</Link>
          </div>
          {(campaigns.data ?? []).length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>No active campaigns yet.</div>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (campaigns.data ?? []).map((c: any) => {
              const sc = STATUS_MAP[c.status] ?? STATUS_MAP.draft;
              const openR = c.stat_sent > 0 ? ((c.stat_opened / c.stat_sent) * 100).toFixed(1) : "—";
              const prog = c.stat_sent > 0 ? Math.min((c.stat_sent / Math.max(c.stat_sent, 500)) * 100, 100) : 0;
              return (
                <div key={c.id} style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {(c.list as { name?: string } | null)?.name ?? "No list"} · {c.stat_sent.toLocaleString()} sent
                    </div>
                    <div style={{ height: 3, background: "var(--muted)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${prog}%`, background: "#534AB7", borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#534AB7" }}>{openR}{openR !== "—" ? "%" : ""}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>open</div>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500, whiteSpace: "nowrap" }}>
                    {sc.label}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Active sequences */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active sequences</span>
            <Link href="/admin/marketing/sequences" style={{ fontSize: 12, color: "#534AB7", textDecoration: "none" }}>View all →</Link>
          </div>
          {(sequences.data ?? []).length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>No active sequences yet.</div>
          ) : (
            (sequences.data ?? []).map((s: { id: string; name: string; status: string }) => {
              const sc = SEQ_STATUS_MAP[s.status] ?? SEQ_STATUS_MAP.draft;
              return (
                <div key={s.id} style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Funnel overview */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>30-day funnel</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {[
            { label: "Sent",      val: sent,   color: "var(--muted-foreground)", bg: "var(--muted)" },
            { label: "Opened",    val: opened,  color: "#534AB7",                bg: "#EEEDFE" },
            { label: "Clicked",   val: clicked, color: "#0F6E56",                bg: "#E1F5EE" },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: s.color }}>{s.val.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{s.label}</div>
              {sent > 0 && s.label !== "Sent" && (
                <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>
                  {((s.val / sent) * 100).toFixed(1)}% of sent
                </div>
              )}
            </div>
          ))}
          <div style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: "var(--muted-foreground)" }}>{(totalContacts ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Total contacts</div>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>+{newContacts7d ?? 0} this week</div>
          </div>
        </div>
      </div>
    </div>
  );
}
