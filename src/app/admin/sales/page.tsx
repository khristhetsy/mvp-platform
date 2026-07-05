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

  const { data: oppRows } = await admin.from("sales_opportunities").select("status, value_cents, stage_id");
  const opps = (oppRows ?? []) as Array<{ status: string; value_cents: number | null; stage_id: string | null }>;
  const open = opps.filter((o) => o.status === "open");
  const won = opps.filter((o) => o.status === "won");
  const pipelineValue = Math.round(open.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100);
  const { count: contactsCount } = await admin.from("crm_contacts").select("id", { count: "exact", head: true });

  const pipelines = await listPipelines();
  const stages = (pipelines.find((p) => p.is_default) ?? pipelines[0])?.stages ?? [];
  const perStage = stages.map((s) => ({ name: s.name, count: open.filter((o) => o.stage_id === s.id).length }));
  const maxStage = Math.max(...perStage.map((s) => s.count), 1);

  const tiles = [
    { label: "Open opportunities", value: open.length.toLocaleString(), href: "/admin/sales/opportunities", bg: "#E6F1FB", accent: "#185FA5", text: "#0C447C", icon: "ti-briefcase" },
    { label: "Won", value: won.length.toLocaleString(), href: "/admin/sales/opportunities", bg: "#E1F5EE", accent: "#0F6E56", text: "#085041", icon: "ti-trophy" },
    { label: "Pipeline value", value: `$${pipelineValue.toLocaleString()}`, href: "/admin/sales/pipeline", bg: "#FAEEDA", accent: "#854F0B", text: "#633806", icon: "ti-coin" },
    { label: "Contacts", value: (contactsCount ?? 0).toLocaleString(), href: "/admin/sales/contacts", bg: "#EEF2FF", accent: "#4338CA", text: "#3730A3", icon: "ti-users" },
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
        </div>
        <SalesAdvisor />
      </div>
    </AppShell>
  );
}
