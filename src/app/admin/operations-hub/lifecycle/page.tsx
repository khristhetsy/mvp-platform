import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAdminCompanies } from "@/lib/data/admin";
import { daysSince, ONBOARDING_SLA_DAYS } from "@/lib/operations/escalations";
import { OpsHubTabs } from "../OpsHubTabs";

export const dynamic = "force-dynamic";

// The six-stage relationship spine. Onboard is the live stage here; the others
// link to the screen that owns that stage.
const STAGES = [
  { key: "capture", label: "Capture", href: "/admin/crm/unclassified" },
  { key: "classify", label: "Classify", href: "/admin/crm/classify" },
  { key: "onboard", label: "Onboard", href: "/admin/operations-hub/lifecycle", current: true },
  { key: "diligence", label: "Diligence", href: "/admin/diligence" },
  { key: "approve", label: "Approve", href: "/admin/companies", gated: true },
  { key: "active", label: "Active · CRM", href: "/admin/crm/founders" },
];

function badge(overdue: number) {
  if (overdue >= ONBOARDING_SLA_DAYS) return { text: `Past due ${overdue}d`, color: "#A32D2D", bg: "#FCEBEB" };
  if (overdue >= ONBOARDING_SLA_DAYS - 2) return { text: "Due soon", color: "#854F0B", bg: "#FAEEDA" };
  return { text: "On track", color: "#0F6E56", bg: "#ECFDF5" };
}

export default async function OperationsLifecyclePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  const companies = await listAdminCompanies(admin).catch(() => []);
  const { data: tsData } = await admin.from("companies").select("id, updated_at");
  const updatedAt = new Map(((tsData ?? []) as Array<{ id: string; updated_at: string | null }>).map((r) => [r.id, r.updated_at]));

  const incomplete = companies
    .filter((c) => !c.onboarding_completed_at)
    .slice()
    .sort((a, b) => (b.onboarding_progress_percent ?? 0) - (a.onboarding_progress_percent ?? 0));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Operations hub</h1>
      </div>
      <OpsHubTabs />

      {/* Founder / Investor toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Lifecycle for:</span>
        <div style={{ display: "inline-flex", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
          <span style={{ fontSize: 12, padding: "5px 12px", background: "#EFF6FF", color: "#1A6CE4", fontWeight: 500 }}>Founders</span>
          <span style={{ fontSize: 12, padding: "5px 12px", background: "#fff", color: "var(--muted-foreground)", borderLeft: "0.5px solid var(--border-strong, #cbd5e1)" }}>Investors · soon</span>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {STAGES.map((s, i) => (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link href={s.href} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600,
                background: s.current ? "#2E78F5" : "transparent", color: s.current ? "#fff" : "var(--muted-foreground)",
                border: s.current ? "none" : "0.5px solid var(--border-strong, #cbd5e1)",
              }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: s.current ? "#185FA5" : "var(--muted-foreground)", fontWeight: s.current ? 600 : 400 }}>{s.label}</span>
              {s.gated && <span style={{ fontSize: 9, color: "#854F0B", background: "#FAEEDA", borderRadius: 4, padding: "0 5px" }}>gated</span>}
            </Link>
            {i < STAGES.length - 1 && <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>→</span>}
          </span>
        ))}
      </div>

      {/* Onboard stage queue */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "11px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Onboard · queue</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{incomplete.length} founders in progress</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 100px 120px", padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Founder</div><div>Company</div><div>Progress</div><div>SLA</div><div></div>
        </div>
        {incomplete.length === 0 ? (
          <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Every founder has completed onboarding. 🎉</p>
        ) : incomplete.slice(0, 40).map((c) => {
          const overdue = daysSince(updatedAt.get(c.id));
          const b = badge(overdue);
          const pct = Math.round(c.onboarding_progress_percent ?? 0);
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 100px 120px", padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: overdue >= ONBOARDING_SLA_DAYS ? "#FEF6F6" : undefined }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.founder?.full_name ?? c.company_name ?? "Founder"}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.founder?.email ?? "—"}</div>
              </div>
              <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company_name ?? "—"}</div>
              <div>
                <div style={{ height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#0F6E56" : "#2E78F5" }} /></div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3 }}>{pct}%</div>
              </div>
              <div><span style={{ fontSize: 10, fontWeight: 700, color: b.color, background: b.bg, borderRadius: 6, padding: "2px 7px" }}>{b.text}</span></div>
              <div style={{ textAlign: "right" }}>
                <Link href={`/admin/companies/${c.id}`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", borderRadius: 6, padding: "5px 12px", textDecoration: "none" }}>Continue →</Link>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
