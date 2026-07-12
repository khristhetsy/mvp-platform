import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAdminCompanies } from "@/lib/data/admin";
import { listEngagements } from "@/lib/diligence/data";
import { daysSince, ONBOARDING_SLA_DAYS, DILIGENCE_SLA_DAYS } from "@/lib/operations/escalations";
import { OperationsHubClient, type Tile, type FunnelSeg, type QueueRow } from "./OperationsHubClient";
import { OpsHubTabs } from "./OpsHubTabs";
import { OpsAdvicePopup } from "./OpsAdvicePopup";
import { LifecycleStepper } from "@/components/admin/LifecycleStepper";
import { investorLifecycle } from "@/lib/lifecycle/counts";

function slaBadge(overdue: number, sla: number): QueueRow["badge"] | undefined {
  if (overdue >= sla) return { text: `Past due ${overdue}d`, color: "#A32D2D", bg: "#FCEBEB", border: "#F09595" };
  if (overdue >= sla - 2) return { text: "Due soon", color: "#854F0B", bg: "#FAEEDA", border: "#F0B65E" };
  return undefined;
}

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  draft: "Draft",
  sent_to_founder: "Sent to founder",
  responding: "Founder responding",
  admin_review: "Admin review",
  consent_requested: "Consent requested",
  consented_locked: "Consent locked",
  released: "Released",
};
const DD_ACTIVE = ["sent_to_founder", "responding", "admin_review", "consent_requested", "consented_locked"];

export default async function OperationsHubPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  const [companies, engagements] = await Promise.all([
    listAdminCompanies(admin).catch(() => []),
    listEngagements(admin).catch(() => []),
  ]);
  const { data: tsData } = await admin.from("companies").select("id, updated_at");
  const updatedAt = new Map(((tsData ?? []) as Array<{ id: string; updated_at: string | null }>).map((r) => [r.id, r.updated_at]));

  // ---- Onboarding ----
  const onboardingComplete = companies.filter((c) => c.onboarding_completed_at).length;
  const onboardingInProgress = companies.length - onboardingComplete;

  // ---- Diligence ----
  const ddInProgress = engagements.filter((e) => DD_ACTIVE.includes(e.lifecycle_stage)).length;
  const ddComplete = engagements.filter((e) => e.lifecycle_stage === "released").length;
  const ddStarted = engagements.filter((e) => e.lifecycle_stage !== "draft").length;

  const tiles: Tile[] = [
    { label: "In onboarding", value: onboardingInProgress, sub: "Finish these", href: "/admin/companies", bg: "#E6F1FB", accent: "#185FA5", text: "#0C447C", icon: "ti-user-plus" },
    { label: "Onboarding complete", value: onboardingComplete, sub: "Ready for diligence", href: "/admin/companies", bg: "#E1F5EE", accent: "#0F6E56", text: "#085041", icon: "ti-user-check" },
    { label: "Diligence in progress", value: ddInProgress, sub: "Move to done", href: "/admin/diligence", bg: "#FAEEDA", accent: "#854F0B", text: "#633806", icon: "ti-file-search" },
    { label: "Diligence complete", value: ddComplete, sub: "Released", href: "/admin/diligence", bg: "#EEF2FF", accent: "#4338CA", text: "#3730A3", icon: "ti-circle-check" },
  ];

  const funnelMax = Math.max(companies.length, 1);
  const funnel: FunnelSeg[] = [
    { label: "Companies", value: companies.length, href: "/admin/companies", color: "#2E78F5", textColor: "#fff", widthPct: 100 },
    { label: "Onboarded", value: onboardingComplete, href: "/admin/companies", color: "#85B7EB", textColor: "#0C447C", widthPct: (onboardingComplete / funnelMax) * 100 },
    { label: "In diligence", value: ddStarted, href: "/admin/diligence", color: "#FAC775", textColor: "#633806", widthPct: (ddStarted / funnelMax) * 100 },
    { label: "DD complete", value: ddComplete, href: "/admin/diligence", color: "#5DCAA5", textColor: "#04342C", widthPct: (ddComplete / funnelMax) * 100 },
  ];

  // ---- Attention: onboarding to finish (closest to done first) ----
  const incomplete = companies.filter((c) => !c.onboarding_completed_at);
  const onboardingQueue: QueueRow[] = incomplete
    .slice()
    .sort((a, b) => (b.onboarding_progress_percent ?? 0) - (a.onboarding_progress_percent ?? 0))
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      title: c.company_name || c.founder?.full_name || "Company",
      subtitle: c.founder?.full_name ? `${c.founder.full_name}${c.founder.email ? ` · ${c.founder.email}` : ""}` : (c.founder?.email ?? "—"),
      href: `/admin/companies/${c.id}`,
      percent: Math.round(c.onboarding_progress_percent ?? 0),
      badge: slaBadge(daysSince(updatedAt.get(c.id)), ONBOARDING_SLA_DAYS),
    }));

  // ---- Attention: diligence needing action (your review first, then founder) ----
  const priority: Record<string, number> = { admin_review: 0, consent_requested: 1, responding: 2, sent_to_founder: 3, consented_locked: 4 };
  const active = engagements.filter((e) => DD_ACTIVE.includes(e.lifecycle_stage));
  const diligenceQueue: QueueRow[] = active
    .slice()
    .sort((a, b) => (priority[a.lifecycle_stage] ?? 9) - (priority[b.lifecycle_stage] ?? 9))
    .slice(0, 8)
    .map((e) => {
      const overdue = daysSince(e.updated_at);
      const yourMove = e.lifecycle_stage === "admin_review" || e.lifecycle_stage === "consent_requested";
      const pastDue = overdue >= DILIGENCE_SLA_DAYS;
      return {
        id: e.id,
        title: e.company_name || "Engagement",
        subtitle: `${STAGE_LABEL[e.lifecycle_stage] ?? e.lifecycle_stage} · ${overdue}d · ${e.confidence_pct ?? 0}% confidence`,
        href: "/admin/diligence",
        badge: pastDue
          ? { text: `Past due ${overdue}d`, color: "#A32D2D", bg: "#FCEBEB", border: "#F09595" }
          : yourMove
            ? { text: "Your review", color: "#3730A3", bg: "#EEF2FF", border: "#C7D2FE" }
            : { text: "Waiting on founder", color: "#854F0B", bg: "#FAEEDA", border: "#F0B65E" },
      } as QueueRow;
    });

  const investorStages = await investorLifecycle();

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
      <p style={{ margin: "0 0 20px", maxWidth: 640, fontSize: 13, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
        Onboarding and due diligence in one view. Every card, bar, and row links straight to the record — so nothing stalls unnoticed.
      </p>

      {investorStages.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <LifecycleStepper title="Investor pipeline" stages={investorStages} accent="#4338CA" askLabel="IR AI" />
        </div>
      )}

      <OperationsHubClient
        tiles={tiles}
        funnel={funnel}
        onboardingQueue={onboardingQueue}
        onboardingRemaining={incomplete.length}
        diligenceQueue={diligenceQueue}
        diligenceRemaining={active.length}
      />
      <OpsAdvicePopup />
    </AppShell>
  );
}
