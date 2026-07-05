import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAdminCompanies } from "@/lib/data/admin";
import { daysSince, ONBOARDING_SLA_DAYS } from "@/lib/operations/escalations";
import { OpsHubTabs } from "../OpsHubTabs";
import { OnboardQueue, type OnboardRow } from "../OnboardQueue";
import { InvestorQueue, type InvestorRow } from "../InvestorQueue";
import { OpsAdvicePopup } from "../OpsAdvicePopup";

export const dynamic = "force-dynamic";

type Stage = { label: string; href: string; current?: boolean; gated?: boolean };
const FOUNDER_STAGES: Stage[] = [
  { label: "Capture", href: "/admin/crm/unclassified" },
  { label: "Classify", href: "/admin/crm/classify" },
  { label: "Onboard", href: "/admin/operations-hub/lifecycle?who=founders", current: true },
  { label: "Diligence", href: "/admin/diligence" },
  { label: "Approve", href: "/admin/companies", gated: true },
  { label: "Active · CRM", href: "/admin/crm/founders" },
];
const INVESTOR_STAGES: Stage[] = [
  { label: "Capture", href: "/admin/crm/unclassified" },
  { label: "Onboard", href: "/admin/operations-hub/lifecycle?who=investors", current: true },
  { label: "Verify · KYC", href: "/admin/investors" },
  { label: "Access", href: "/admin/investors" },
  { label: "Manage · CRM", href: "/admin/crm/investors" },
];

function badge(overdue: number, sla: number) {
  if (overdue >= sla) return { text: `Past due ${overdue}d`, color: "#A32D2D", bg: "#FCEBEB" };
  if (overdue >= sla - 2) return { text: "Due soon", color: "#854F0B", bg: "#FAEEDA" };
  return { text: "On track", color: "#0F6E56", bg: "#ECFDF5" };
}

export default async function OperationsLifecyclePage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();
  const who = (await searchParams)?.who === "investors" ? "investors" : "founders";

  let onboardRows: OnboardRow[] = [];
  let investorRows: InvestorRow[] = [];

  if (who === "founders") {
    const companies = await listAdminCompanies(admin).catch(() => []);
    const { data: tsData } = await admin.from("companies").select("id, updated_at");
    const updatedAt = new Map(((tsData ?? []) as Array<{ id: string; updated_at: string | null }>).map((r) => [r.id, r.updated_at]));
    onboardRows = companies
      .filter((c) => !c.onboarding_completed_at)
      .slice()
      .sort((a, b) => (b.onboarding_progress_percent ?? 0) - (a.onboarding_progress_percent ?? 0))
      .slice(0, 40)
      .map((c) => {
        const overdue = daysSince(updatedAt.get(c.id));
        return {
          id: c.id,
          founderName: c.founder?.full_name ?? c.company_name ?? "Founder",
          founderEmail: c.founder?.email ?? "—",
          company: c.company_name ?? "—",
          percent: Math.round(c.onboarding_progress_percent ?? 0),
          sla: badge(overdue, ONBOARDING_SLA_DAYS),
          pastDue: overdue >= ONBOARDING_SLA_DAYS,
        };
      });
  } else {
    const { data } = await admin
      .from("investor_profiles")
      .select("id, firm_name, approval_status, kyc_status, submitted_at, updated_at, profiles:profile_id(full_name, email)")
      .neq("approval_status", "approved")
      .limit(60);
    investorRows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const p = (r.profiles ?? {}) as { full_name?: string; email?: string };
      const overdue = daysSince((r.submitted_at as string) ?? (r.updated_at as string) ?? null);
      return {
        id: String(r.id),
        name: p.full_name ?? p.email ?? "Investor",
        firm: (r.firm_name as string) ?? "—",
        email: p.email ?? "—",
        approval: (r.approval_status as string) ?? "draft",
        kyc: (r.kyc_status as string) ?? "not_started",
        sla: badge(overdue, ONBOARDING_SLA_DAYS),
        pastDue: overdue >= ONBOARDING_SLA_DAYS && !!r.submitted_at,
      };
    });
  }

  const STAGES = who === "founders" ? FOUNDER_STAGES : INVESTOR_STAGES;
  const toggle = (target: "founders" | "investors", label: string) => {
    const activeTab = who === target;
    return (
      <Link href={`/admin/operations-hub/lifecycle?who=${target}`} style={{ fontSize: 12, padding: "5px 12px", textDecoration: "none", background: activeTab ? "#EFF6FF" : "#fff", color: activeTab ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: activeTab ? 500 : 400 }}>{label}</Link>
    );
  };

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
          {toggle("founders", "Founders")}
          <span style={{ borderLeft: "0.5px solid var(--border-strong, #cbd5e1)" }} />
          {toggle("investors", "Investors")}
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {STAGES.map((s, i) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

      {who === "founders" ? <OnboardQueue rows={onboardRows} /> : <InvestorQueue rows={investorRows} />}
      <OpsAdvicePopup />
    </AppShell>
  );
}
