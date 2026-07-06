import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listPipelines } from "@/lib/sales/pipelines";
import { SalesHubHeader } from "./SalesHubHeader";
import { SalesAdvisor } from "./SalesAdvisor";

export const dynamic = "force-dynamic";

export default async function SalesDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createServiceRoleClient();

  const { data: oppRows } = await admin.from("sales_opportunities").select("status, value_cents, stage_id, billing, probability, updated_at");
  const opps = (oppRows ?? []) as Array<{ status: string; value_cents: number | null; stage_id: string | null; billing: string | null; probability: number | null; updated_at: string | null }>;
  const open = opps.filter((o) => o.status === "open");
  const won = opps.filter((o) => o.status === "won");
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
  const stalledCount = open.filter((o) => o.updated_at && new Date(o.updated_at).getTime() < staleBefore).length;
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const { count: overdueCount } = await admin.from("sales_tasks").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_date", today);

  const pipelines = await listPipelines();
  const stages = (pipelines.find((p) => p.is_default) ?? pipelines[0])?.stages ?? [];
  const perStage = stages.map((s) => ({ name: s.name, count: open.filter((o) => o.stage_id === s.id).length }));
  const maxStage = Math.max(...perStage.map((s) => s.count), 1);

  const tiles = [
    { label: "Open opportunities", value: open.length.toLocaleString(), href: "/admin/sales/opportunities", bg: "#E6F1FB", accent: "#185FA5", text: "#0C447C", icon: "ti-briefcase" },
    { label: "Pipeline value", value: `$${pipelineValue.toLocaleString()}`, sub: `weighted $${weightedValue.toLocaleString()}`, href: "/admin/sales/pipeline", bg: "#FAEEDA", accent: "#854F0B", text: "#633806", icon: "ti-coin" },
    { label: "Expected MRR", value: `$${expectedMrr.toLocaleString()}`, href: "/admin/sales/opportunities", bg: "#E1F5EE", accent: "#0F6E56", text: "#085041", icon: "ti-repeat" },
    { label: "Won", value: won.length.toLocaleString(), href: "/admin/sales/opportunities", bg: "#EEF2FF", accent: "#4338CA", text: "#3730A3", icon: "ti-trophy" },
  ];

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} style={{ display: "block", background: t.bg, borderRadius: 14, padding: 16, textDecoration: "none" }}>
            <div style={{ fontSize: 20, color: t.accent, lineHeight: 1 }}><i className={`ti ${t.icon}`} aria-hidden="true" /></div>
            <div style={{ fontSize: 26, fontWeight: 500, color: t.text, marginTop: 8 }}>{t.value}</div>
            <div style={{ fontSize: 11.5, color: t.accent, marginTop: 2 }}>{t.label} →</div>
            {"sub" in t && t.sub ? <div style={{ fontSize: 10.5, color: t.accent, marginTop: 1, opacity: 0.85 }}>{t.sub}</div> : null}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 14 }}>Open pipeline by stage</div>
          {perStage.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No stages yet.</p> : perStage.map((s) => (
            <Link key={s.name} href="/admin/sales/pipeline" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9, textDecoration: "none" }}>
              <span style={{ width: 90, fontSize: 11.5, color: "var(--muted-foreground)", textAlign: "right", flexShrink: 0 }}>{s.name}</span>
              <div style={{ flex: 1, height: 24, background: "var(--muted)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max((s.count / maxStage) * 100, 6)}%`, background: "#85B7EB", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 10, fontSize: 12, fontWeight: 500, color: "#0C447C" }}>{s.count}</div>
              </div>
            </Link>
          ))}
          {(stalledCount > 0 || (overdueCount ?? 0) > 0) && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
              {stalledCount > 0 && <Link href="/admin/sales/opportunities" style={{ fontSize: 11, color: "#A32D2D", background: "#FCEBEB", borderRadius: 8, padding: "4px 9px", textDecoration: "none" }}><i className="ti ti-clock" aria-hidden="true" /> {stalledCount} stalled {stalledDays}d+</Link>}
              {(overdueCount ?? 0) > 0 && <Link href="/admin/sales/tasks" style={{ fontSize: 11, color: "#854F0B", background: "#FAEEDA", borderRadius: 8, padding: "4px 9px", textDecoration: "none" }}><i className="ti ti-calendar-exclamation" aria-hidden="true" /> {overdueCount} task{overdueCount === 1 ? "" : "s"} overdue</Link>}
            </div>
          )}
        </div>
        <SalesAdvisor />
      </div>
    </AppShell>
  );
}
