import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import Link from "next/link";

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

export default async function MarketingDashboardPage() {
  await requireRole(["admin"]);
  const supabase = await marketingDb();
  const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const since7d  = new Date(Date.now() - 7  * 86400 * 1000).toISOString();

  const [
    { count: totalContacts },
    { count: newContacts7d },
    { count: totalSent30d },
    { count: totalOpened30d },
    { count: totalClicked30d },
    { count: totalReplies30d },
    campaigns,
    sequences,
  ] = await Promise.all([
    supabase.from("marketing_contacts").select("*", { count: "exact", head: true }),
    supabase.from("marketing_contacts").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "sent").gte("occurred_at", since30d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "opened").gte("occurred_at", since30d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "clicked").gte("occurred_at", since30d),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "replied").gte("occurred_at", since30d),
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

  const sent = totalSent30d ?? 0;
  const opened = totalOpened30d ?? 0;
  const clicked = totalClicked30d ?? 0;
  const openRate = sent > 0 ? (opened / sent) * 100 : 0;
  const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;

  const statCards = [
    {
      icon: "👥", label: "Total contacts", value: (totalContacts ?? 0).toLocaleString(),
      delta: `+${newContacts7d ?? 0} this week`, deltaGood: (newContacts7d ?? 0) > 0,
    },
    {
      icon: "📤", label: "Emails sent (30d)", value: sent.toLocaleString(),
      delta: `${(campaigns.data ?? []).length} active campaigns`, deltaGood: true,
    },
    {
      icon: "📬", label: "Open rate", value: `${openRate.toFixed(1)}%`,
      delta: openRate >= 21 ? "Above 21% benchmark" : `${(21 - openRate).toFixed(1)}pts below benchmark`,
      deltaGood: openRate >= 21,
    },
    {
      icon: "🖱️", label: "Click rate", value: `${clickRate.toFixed(1)}%`,
      delta: clickRate >= 3.5 ? "Above 3.5% target" : `${(3.5 - clickRate).toFixed(1)}pts below target`,
      deltaGood: clickRate >= 3.5,
    },
  ];

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
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#534AB7", color: "#EEEDFE", padding: "7px 14px", borderRadius: 8, fontSize: 13, textDecoration: "none", fontWeight: 500 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New campaign
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 18 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: "var(--foreground)" }}>{s.value}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: s.deltaGood ? "#0F6E56" : "#993C1D" }}>
              {s.deltaGood ? "↑" : "↓"} {s.delta}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
        {/* Active campaigns */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active campaigns</span>
            <Link href="/admin/marketing/campaigns" style={{ fontSize: 12, color: "#534AB7", textDecoration: "none" }}>View all →</Link>
          </div>
          {(campaigns.data ?? []).length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--muted-foreground)" }}>No active campaigns yet.</div>
          ) : (
            (campaigns.data ?? []).map((c: { id: string; name: string; status: string; stat_sent: number; stat_opened: number; stat_clicked: number; list: { name: string } | null }) => {
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
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active sequences</span>
            <Link href="/admin/marketing/sequences" style={{ fontSize: 12, color: "#534AB7", textDecoration: "none" }}>View all →</Link>
          </div>
          {(sequences.data ?? []).length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--muted-foreground)" }}>No active sequences yet.</div>
          ) : (
            (sequences.data ?? []).map((s: { id: string; name: string; status: string }) => {
              const sc = SEQ_STATUS_MAP[s.status] ?? SEQ_STATUS_MAP.draft;
              return (
                <div key={s.id} style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{s.name}</div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
