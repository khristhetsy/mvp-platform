import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listPipelines } from "@/lib/sales/pipelines";
import { SalesHubHeader } from "./SalesHubHeader";
import { SalesAdvisor } from "./SalesAdvisor";
import { getSalesScope, effectiveSalesOwner } from "@/lib/sales/scope";

export const dynamic = "force-dynamic";

const SALES_PERIOD_DAYS: Record<string, number> = { week: 7, month: 30, qtr: 90, year: 365 };
const SALES_PERIODS: Array<{ key: string; short: string }> = [{ key: "week", short: "Week" }, { key: "month", short: "Month" }, { key: "qtr", short: "Qtr" }, { key: "year", short: "Year" }];

export default async function SalesDashboardPage({ searchParams }: { searchParams: Promise<{ viewAs?: string; period?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createServiceRoleClient();
  const sp = await searchParams;
  const viewAs = sp.viewAs ?? null;
  const period = SALES_PERIOD_DAYS[sp.period ?? ""] ? (sp.period as string) : "qtr";
  const periodDays = SALES_PERIOD_DAYS[period];
  const scope = await getSalesScope(profile, viewAs);
  const owner = effectiveSalesOwner(scope);
  const withView = (href: string) =>
    viewAs && viewAs !== "team" ? `${href}${href.includes("?") ? "&" : "?"}viewAs=${encodeURIComponent(viewAs)}` : href;
  // Preserve viewAs, then swap period — for the period toggle links.
  const withPeriod = (p: string) => {
    const base = withView("/admin/sales");
    return `${base}${base.includes("?") ? "&" : "?"}period=${p}`;
  };

  let oppQuery = admin.from("sales_opportunities").select("id, name, status, value_cents, stage_id, billing, probability, updated_at");
  if (owner) oppQuery = oppQuery.eq("owner_id", owner);
  const { data: oppRows } = await oppQuery;
  const opps = (oppRows ?? []) as Array<{ id: string; name: string | null; status: string; value_cents: number | null; stage_id: string | null; billing: string | null; probability: number | null; updated_at: string | null }>;
  const open = opps.filter((o) => o.status === "open");
  const won = opps.filter((o) => o.status === "won");
  const lost = opps.filter((o) => o.status === "lost");
  // Win rate is scoped to the selected period (by close/update time); won count stays all-time.
  // eslint-disable-next-line react-hooks/purity -- server component, single render
  const periodSince = Date.now() - periodDays * 86400000;
  const inPeriod = (o: { updated_at: string | null }) => o.updated_at != null && new Date(o.updated_at).getTime() >= periodSince;
  const wonInPeriod = won.filter(inPeriod).length;
  const lostInPeriod = lost.filter(inPeriod).length;
  const winRate = wonInPeriod + lostInPeriod > 0 ? Math.round((wonInPeriod / (wonInPeriod + lostInPeriod)) * 100) : null;
  const mrrCents = (o: { value_cents: number | null; billing: string | null }) => (o.value_cents == null ? 0 : o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12));
  const pipelineValue = Math.round(open.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100);
  const weightedValue = Math.round(open.reduce((a, o) => a + (o.value_cents ?? 0) * ((o.probability ?? 0) / 100), 0) / 100);
  const expectedMrr = Math.round(open.reduce((a, o) => a + mrrCents(o), 0) / 100);

  // Stalled + overdue callouts (settings-driven stalled window).
  const { data: settingsRow } = await admin.from("sales_settings").select("stalled_days").eq("id", "default").maybeSingle();
  const stalledDays = (settingsRow?.stalled_days as number | undefined) ?? 14;
  // eslint-disable-next-line react-hooks/purity -- server component; single render, real request time
  const nowMs = Date.now();
  const staleBefore = nowMs - stalledDays * 86400000;
  const stalledOpps = open.filter((o) => o.updated_at && new Date(o.updated_at).getTime() < staleBefore);
  const stalledCount = stalledOpps.length;
  const stalledValue = Math.round(stalledOpps.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100);
  const today = new Date(nowMs).toISOString().slice(0, 10);
  let overdueQuery = admin.from("sales_tasks").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_date", today);
  if (owner) overdueQuery = overdueQuery.eq("assignee_id", owner);
  const { count: overdueCount } = await overdueQuery;

  const pipelines = await listPipelines();
  const stages = (pipelines.find((p) => p.is_default) ?? pipelines[0])?.stages ?? [];
  const totalOpen = open.length || 1;
  // Ring per lifecycle stage: count in the center, fill = share of the open funnel.
  const RING_PALETTE = ["#2E78F5", "#3B82C4", "#0F6E56", "#854F0B", "#2E78F5", "#0F6E56", "#A32D2D"];
  const ringStages = stages
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s, i) => {
      const count = open.filter((o) => o.stage_id === s.id).length;
      return { key: s.id, label: s.name, count, share: Math.round((count / totalOpen) * 100), color: RING_PALETTE[i % RING_PALETTE.length], href: withView(`/admin/sales/pipeline?stage=${s.id}`) };
    });
  const stageName = new Map(stages.map((s) => [s.id, s.name] as const));
  // Bottleneck: the stage with the largest drop from its predecessor (by count).
  let bottleneck: string | null = null;
  for (let i = 1; i < ringStages.length; i++) {
    if (ringStages[i - 1].count > 0 && ringStages[i].count < ringStages[i - 1].count) { bottleneck = `${ringStages[i - 1].label} → ${ringStages[i].label}`; break; }
  }
  const biggestStage = ringStages.reduce((a, b) => (b.count > a.count ? b : a), ringStages[0] ?? { label: "", share: 0 });

  // Top movers: biggest open opportunities by value.
  const topMovers = [...open]
    .sort((a, b) => (b.value_cents ?? 0) - (a.value_cents ?? 0))
    .slice(0, 4)
    .map((o) => ({ id: o.id, name: o.name ?? "Opportunity", stage: (o.stage_id && stageName.get(o.stage_id)) || "—", value: Math.round((o.value_cents ?? 0) / 100) }));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />

      {/* Command Center — lifecycle rings + health line */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "16px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Sales lifecycle</span>
          <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{open.length} in funnel</span>
          <div style={{ display: "flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {SALES_PERIODS.map((p) => (
              <Link key={p.key} href={withPeriod(p.key)} style={{ fontSize: 11, padding: "4px 10px", textDecoration: "none", background: period === p.key ? "#2E78F5" : "transparent", color: period === p.key ? "#fff" : "var(--muted-foreground)", borderLeft: p.key !== "week" ? "0.5px solid var(--border)" : "none" }}>{p.short}</Link>
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#0C447C", background: "#E6F1FB", borderRadius: 999, padding: "3px 11px" }}>
            {winRate !== null ? `Win rate ${winRate}% this ${period === "qtr" ? "quarter" : period}` : "Win rate —"} · {won.length} won all-time
          </span>
        </div>

        {ringStages.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No pipeline stages yet.</p> : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4 }}>
            {ringStages.map((s, i) => {
              const C = 175.93; const off = C * (1 - Math.min(100, s.share) / 100);
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
                  <Link href={s.href} style={{ textAlign: "center", width: 90, textDecoration: "none", display: "block" }}>
                    <svg viewBox="0 0 72 72" style={{ width: 64, height: 64 }} role="img" aria-label={`${s.label} ${s.count}`}>
                      <circle cx="36" cy="36" r="28" fill="none" stroke="#eef2f7" strokeWidth="6" />
                      <circle cx="36" cy="36" r="28" fill="none" stroke={s.color} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 36 36)" />
                      <text x="36" y="41" fontSize={s.count >= 100 ? "14" : "16"} fontWeight="700" fill="#0f172a" textAnchor="middle">{s.count}</text>
                    </svg>
                    <div style={{ fontSize: 9.5, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: "var(--muted-foreground)", opacity: 0.8 }}>{s.share}%</div>
                  </Link>
                  {i < ringStages.length - 1 && <span style={{ color: "var(--muted-foreground)", fontSize: 12, flex: "0 0 auto" }}>›</span>}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ borderTop: "0.5px solid #eef1f5", marginTop: 12, paddingTop: 9, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted-foreground)" }}>
          <Link href={withView("/admin/sales/opportunities")} style={{ textDecoration: "none", color: "var(--muted-foreground)" }}><b style={{ color: "var(--foreground)" }}>{open.length}</b> open opportunities</Link>
          <Link href={withView("/admin/sales/pipeline")} style={{ textDecoration: "none", color: "var(--muted-foreground)" }}><b style={{ color: "var(--foreground)" }}>${pipelineValue.toLocaleString()}</b> pipeline <span style={{ opacity: 0.8 }}>(weighted ${weightedValue.toLocaleString()})</span></Link>
          <span><b style={{ color: "var(--foreground)" }}>${expectedMrr.toLocaleString()}</b> expected MRR</span>
          {bottleneck && <span style={{ color: "#A32D2D" }}>Bottleneck → <b>{bottleneck}</b></span>}
        </div>
      </div>

      {/* Top movers + Next best actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Top movers <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>· by value</span></div>
          {topMovers.length === 0 ? <p style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>No open opportunities.</p> : topMovers.map((m) => (
            <Link key={m.id} href={withView(`/admin/sales/opportunities/${m.id}`)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, textDecoration: "none", color: "var(--foreground)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#2E78F5", flexShrink: 0 }} />
              <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
              <span style={{ color: "var(--muted-foreground)" }}>{m.stage} · ${m.value.toLocaleString()}</span>
            </Link>
          ))}
          <Link href={withView("/admin/sales/pipeline")} style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, color: "#2E78F5", textDecoration: "none" }}>View pipeline →</Link>
        </div>
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Next best actions</div>
          {stalledCount > 0 && <Link href={withView("/admin/sales/opportunities")} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 11.5, textDecoration: "none", color: "var(--foreground)" }}><span style={{ color: "#A32D2D" }}>!</span><span><b style={{ fontWeight: 500 }}>{stalledCount} deal{stalledCount === 1 ? "" : "s"} stalled {stalledDays}d+</b>{stalledValue > 0 ? ` — worth $${stalledValue.toLocaleString()}` : ""}. <span style={{ color: "#2E78F5" }}>Review →</span></span></Link>}
          {(overdueCount ?? 0) > 0 && <Link href={withView("/admin/sales/tasks")} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 11.5, textDecoration: "none", color: "var(--foreground)" }}><span style={{ color: "#854F0B" }}>◔</span><span><b style={{ fontWeight: 500 }}>{overdueCount} task{overdueCount === 1 ? "" : "s"} overdue</b> — follow-ups past due. <span style={{ color: "#2E78F5" }}>Open Tasks →</span></span></Link>}
          {biggestStage.share >= 40 && <Link href={withView("/admin/sales/pipeline")} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 11.5, textDecoration: "none", color: "var(--foreground)" }}><span style={{ color: "#0F6E56" }}>★</span><span><b style={{ fontWeight: 500 }}>{biggestStage.label} is {biggestStage.share}% of the funnel</b> — advance parked deals. <span style={{ color: "#2E78F5" }}>Go →</span></span></Link>}
          {stalledCount === 0 && (overdueCount ?? 0) === 0 && biggestStage.share < 40 && <p style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Nothing urgent — pipeline looks healthy.</p>}
        </div>
      </div>

      <SalesAdvisor viewAs={owner ?? undefined} />
    </AppShell>
  );
}
