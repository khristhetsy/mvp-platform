import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { marketingDb } from "@/lib/marketing/db";
import Link from "next/link";
import { marketingLifecycle } from "@/lib/lifecycle/counts";
import { MarketingAdvisor } from "@/components/marketing/MarketingAdvisor";

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

// Ring colors across the lead lifecycle stages.
const LIFECYCLE_PALETTE = ["#6D28D9", "#7C3AED", "#0F6E56", "#854F0B", "#7C3AED", "#0F6E56"];

// Shared white card style
const card = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
} as React.CSSProperties;

const PERIOD_DAYS: Record<string, number> = { week: 7, "30d": 30, qtr: 90, year: 365 };
const PERIOD_LABEL: Record<string, string> = { week: "Last 7 days", "30d": "Last 30 days", qtr: "Last quarter", year: "Last year" };
const PERIODS: Array<{ key: string; short: string }> = [{ key: "week", short: "Week" }, { key: "30d", short: "30d" }, { key: "qtr", short: "Qtr" }, { key: "year", short: "Year" }];

export default async function MarketingDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  const supabase = await marketingDb();
  const period = PERIOD_DAYS[(await searchParams).period ?? ""] ? ((await searchParams).period as string) : "30d";
  const days = PERIOD_DAYS[period];
  // eslint-disable-next-line react-hooks/purity
  const sinceISO = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const marketingStages = await marketingLifecycle();

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
    supabase.from("marketing_contacts").select("*", { count: "exact", head: true }).gte("created_at", sinceISO),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "sent").gte("occurred_at", sinceISO),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "opened").gte("occurred_at", sinceISO),
    supabase.from("marketing_events").select("*", { count: "exact", head: true }).eq("event_type", "clicked").gte("occurred_at", sinceISO),
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

  // Command-center derivations
  const lifecycleTotal = marketingStages.reduce((a, s) => a + s.count, 0);
  let lifecycleBottleneck: string | null = null;
  for (let i = 1; i < marketingStages.length; i++) {
    if (marketingStages[i - 1].count > 0 && marketingStages[i].count < marketingStages[i - 1].count) {
      lifecycleBottleneck = `${marketingStages[i - 1].label} → ${marketingStages[i].label}`; break;
    }
  }
  const activeCampaignCount = (campaigns.data ?? []).length;
  const activeSequenceCount = (sequences.data ?? []).length;
  const newStageCount = marketingStages[0]?.count ?? 0;
  const downstream = marketingStages.slice(1).reduce((a, s) => a + s.count, 0);
  const nextActions: Array<{ icon: string; tone: string; title: string; detail: string; cta: string; href: string }> = [];
  if (newStageCount > 0 && downstream === 0)
    nextActions.push({ icon: "!", tone: "#A32D2D", title: `${newStageCount.toLocaleString()} leads uncontacted`, detail: "— launch a campaign to move them forward.", cta: "Set up", href: "/admin/marketing/campaigns" });
  if (activeCampaignCount === 0)
    nextActions.push({ icon: "◔", tone: "#854F0B", title: "No active campaigns", detail: "— create one to start reaching contacts.", cta: "New campaign", href: "/admin/marketing/campaigns" });
  if (activeSequenceCount > 0)
    nextActions.push({ icon: "★", tone: "#0F6E56", title: `${activeSequenceCount} active sequence${activeSequenceCount === 1 ? "" : "s"}`, detail: "— review cadence and performance.", cta: "Open sequences", href: "/admin/marketing/sequences" });

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>{t("overviewP")}</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{PERIOD_LABEL[period]}</div>
        </div>
        <Link
          href="/admin/marketing/campaigns"
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#2E78F5", color: "#EEEDFE", padding: "7px 14px", borderRadius: 8, fontSize: 12, textDecoration: "none", fontWeight: 500 }}
        >
          + New campaign
        </Link>
      </div>

      {/* Command Center — lead lifecycle rings + health line */}
      <div style={{ ...card, padding: "16px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Lead lifecycle</span>
          <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{lifecycleTotal.toLocaleString()} in funnel</span>
          <div style={{ display: "flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {PERIODS.map((p) => (
              <Link key={p.key} href={p.key === "30d" ? "/admin/marketing" : `/admin/marketing?period=${p.key}`} style={{ fontSize: 11, padding: "4px 10px", textDecoration: "none", background: period === p.key ? "#6D28D9" : "transparent", color: period === p.key ? "#fff" : "var(--muted-foreground)", borderLeft: p.key !== "week" ? "0.5px solid var(--border)" : "none" }}>{p.short}</Link>
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 11, color: openRate >= 21 ? "#3B6D11" : "#854F0B", background: openRate >= 21 ? "#EAF3DE" : "#FAEEDA", borderRadius: 999, padding: "3px 11px" }}>Open {openRate.toFixed(1)}% {openRate >= 21 ? "· above benchmark" : ""}</span>
        </div>
        {marketingStages.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No lifecycle stages yet.</p> : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4 }}>
            {marketingStages.map((s, i) => {
              const share = lifecycleTotal > 0 ? Math.round((s.count / lifecycleTotal) * 100) : 0;
              const C = 175.93; const off = C * (1 - Math.min(100, share) / 100);
              const color = LIFECYCLE_PALETTE[i % LIFECYCLE_PALETTE.length];
              const big = s.count >= 10000 ? `${(s.count / 1000).toFixed(1)}k` : s.count >= 1000 ? `${(s.count / 1000).toFixed(1)}k` : String(s.count);
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
                  <Link href={s.href ?? "#"} style={{ textAlign: "center", width: 94, textDecoration: "none", display: "block" }}>
                    <svg viewBox="0 0 72 72" style={{ width: 64, height: 64 }} role="img" aria-label={`${s.label} ${s.count}`}>
                      <circle cx="36" cy="36" r="28" fill="none" stroke="#eef2f7" strokeWidth="6" />
                      <circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 36 36)" />
                      <text x="36" y="41" fontSize={s.count >= 1000 ? "12" : "16"} fontWeight="700" fill="#0f172a" textAnchor="middle">{big}</text>
                    </svg>
                    <div style={{ fontSize: 9.5, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: "var(--muted-foreground)", opacity: 0.8 }}>{share}%</div>
                  </Link>
                  {i < marketingStages.length - 1 && <span style={{ color: "var(--muted-foreground)", fontSize: 12, flex: "0 0 auto" }}>›</span>}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ borderTop: "0.5px solid #eef1f5", marginTop: 12, paddingTop: 9, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted-foreground)" }}>
          <Link href="/admin/marketing/contacts" style={{ textDecoration: "none", color: "var(--muted-foreground)" }}><b style={{ color: "var(--foreground)" }}>{(totalContacts ?? 0).toLocaleString()}</b> contacts <span style={{ opacity: 0.8 }}>(+{newContacts7d ?? 0} this week)</span></Link>
          <span><b style={{ color: "var(--foreground)" }}>{sent.toLocaleString()}</b> emails sent (30d)</span>
          <span><b style={{ color: "var(--foreground)" }}>{openRate.toFixed(1)}%</b> open</span>
          <span><b style={{ color: "var(--foreground)" }}>{clickRate.toFixed(1)}%</b> click</span>
          {lifecycleBottleneck && <span style={{ color: "#A32D2D" }}>Bottleneck → <b>{lifecycleBottleneck}</b></span>}
        </div>
      </div>

      {/* Next best actions */}
      <div style={{ ...card, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Next best actions</div>
        {nextActions.length === 0 ? <p style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Nothing urgent — funnel looks healthy.</p> : nextActions.map((a, i) => (
          <Link key={i} href={a.href} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 11.5, textDecoration: "none", color: "var(--foreground)" }}>
            <span style={{ color: a.tone }}>{a.icon}</span><span><b style={{ fontWeight: 500 }}>{a.title}</b> {a.detail} <span style={{ color: "#2E78F5" }}>{a.cta} →</span></span>
          </Link>
        ))}
      </div>

      {/* AI Marketing Advisor */}
      <MarketingAdvisor funnelSummary={marketingStages.map((s) => `${s.label} ${s.count}`).join(", ")} />

      {/* Campaigns + Sequences */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Active campaigns */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active campaigns</span>
            <Link href="/admin/marketing/campaigns" style={{ fontSize: 12, color: "#2E78F5", textDecoration: "none" }}>View all →</Link>
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
                      <div style={{ height: "100%", width: `${prog}%`, background: "#2E78F5", borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#2E78F5" }}>{openR}{openR !== "—" ? "%" : ""}</div>
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
            <Link href="/admin/marketing/sequences" style={{ fontSize: 12, color: "#2E78F5", textDecoration: "none" }}>View all →</Link>
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
    </div>
  );
}
