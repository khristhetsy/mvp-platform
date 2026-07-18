"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import { CompanyCompliancePanel } from "@/components/admin/company-workspace/CompanyCompliancePanel";
import { CompanyDocumentsPanel } from "@/components/admin/company-workspace/CompanyDocumentsPanel";
import { CompanyBusinessPlanPanel } from "@/components/admin/company-workspace/CompanyBusinessPlanPanel";
import { CompanyCapTablePanel } from "@/components/admin/company-workspace/CompanyCapTablePanel";
import { CompanyInvestorActivityPanel } from "@/components/admin/company-workspace/CompanyInvestorActivityPanel";
import { CompanyQueuesPanel } from "@/components/admin/company-workspace/CompanyQueuesPanel";
import { CompanyReadinessPanel } from "@/components/admin/company-workspace/CompanyReadinessPanel";
import { CompanySpvPanel } from "@/components/admin/company-workspace/CompanySpvPanel";
import { CompanyTimelinePanel } from "@/components/admin/company-workspace/CompanyTimelinePanel";
import { CompanyWorkspaceHeader } from "@/components/admin/company-workspace/CompanyWorkspaceHeader";
import { CompanyWorkspaceReportsPanel } from "@/components/admin/company-workspace/CompanyWorkspaceReportsPanel";
import { PageSection } from "@/components/ui/workspace-layout";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { WorkflowDependencyPanel } from "@/components/workflow/WorkflowDependencyPanel";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import type { AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";
import type { WorkflowDependency } from "@/lib/automation/types";
import type { NextBestAction, NextBestActionRole } from "@/lib/next-best-actions/types";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";
import { RiskSignalsPanel } from "@/components/predictive-intelligence/RiskSignalsPanel";
import { AdminCompanyAIAssessment } from "@/components/admin/AdminCompanyAIAssessment";
import { InvestableReadinessPanel } from "@/components/investor/InvestableReadinessPanel";
import { FounderJourneyPanel } from "@/components/admin/company-workspace/FounderJourneyPanel";
import { NotificationSettings } from "@/components/admin/company-workspace/NotificationSettings";

const TABS = [
  { key: "initialize", label: "Initialize" },
  { key: "qualify", label: "Qualify" },
  { key: "deploy", label: "Deploy" },
  { key: "review", label: "Review" },
  { key: "optimize", label: "Optimize" },
  { key: "tools", label: "Analytics & Tools" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AdminCompanyWorkspace({
  data,
  nextBestActions = [],
  workflowDependencies = [],
  adminRole = "admin",
  riskSignals = [],
}: Readonly<{
  data: AdminCompanyWorkspaceData;
  nextBestActions?: NextBestAction[];
  workflowDependencies?: WorkflowDependency[];
  adminRole?: NextBestActionRole;
  riskSignals?: RiskSignal[];
}>) {
  const t = useTranslations("adminCmp");
  const [tab, setTab] = useState<TabKey>("initialize");

  const reviewMarketplace = (
    <PageSection
      title={t("review_marketplace_actions")}
      subtitle={t("same_controls_as_the_companies_list_changes")}
      action={
        <Link href="/admin/companies" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Back to all companies
        </Link>
      }
    >
      <AdminCompanyCard company={data.company} />
    </PageSection>
  );

  const investorActivity = (
    <PageSection title={t("investor_activity")} subtitle={t("aggregates_only_no_message_bodies")}>
      <CompanyInvestorActivityPanel activity={data.investorActivity} companyId={data.company.id} />
    </PageSection>
  );

  const spvOperations = (
    <PageSection title={t("spv_operations")} subtitle={t("source_spv_opportunities")}>
      <CompanySpvPanel spvs={data.spvs} companyId={data.company.id} />
    </PageSection>
  );

  const investablePanel = data.investable ? (
    <PageSection
      title="Investable Readiness"
      subtitle="13-factor investability model — factor breakdown, recommendations, and score history"
    >
      <InvestableReadinessPanel
        companyName={data.company.company_name}
        totalScore={data.investable.totalScore}
        factorScores={data.investable.factorScores}
        effectiveScore={data.investable.effectiveScore}
        isOverridden={data.investable.isOverridden}
        scoredAt={data.investable.scoredAt}
        scoreHistory={data.investable.history}
      />
    </PageSection>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Persistent summary strip — scores stay visible on every tab */}
      <CompanyWorkspaceHeader data={data} />

      {/* Stage tab menu */}
      <div className="sticky top-0 z-10 -mx-2 border-b border-slate-200 bg-white/90 px-2 backdrop-blur">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tabItem) => {
            const active = tabItem.key === tab;
            return (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => setTab(tabItem.key)}
                className={`relative whitespace-nowrap px-3.5 py-3 text-sm font-semibold transition ${
                  active ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tabItem.label}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-indigo-600" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ---------- INITIALIZE ---------- */}
      {tab === "initialize" ? (
        <div className="space-y-6">
          <PageSection title="Founder Journey" subtitle="Current stage, gates, and what's pending to advance">
            <FounderJourneyPanel journey={data.journey} companyId={data.company.id} />
          </PageSection>

          <DraftEmailPanel
            role={adminRole}
            entityType="company"
            entityId={data.company.id}
            defaultTemplate="admin_company_review_followup"
          />

          {workflowDependencies.length > 0 ? (
            <WorkflowDependencyPanel dependencies={workflowDependencies} title={t("company_workflow_blockers")} />
          ) : null}

          {nextBestActions.length > 0 ? (
            <PageSection title="Operational priorities" subtitle={t("items_affecting_this_company_across_operatio")}>
              <NextBestActionsPanel
                role={adminRole}
                initialActions={nextBestActions}
                entityType="company"
                entityId={data.company.id}
                limit={3}
                showEscalate
              />
            </PageSection>
          ) : null}

          <PageSection title={t("active_queues")} subtitle={t("items_affecting_this_company_across_operatio")}>
            <CompanyQueuesPanel items={data.queueItems} companyId={data.company.id} />
          </PageSection>
        </div>
      ) : null}

      {/* ---------- QUALIFY ---------- */}
      {tab === "qualify" ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <PageSection title={t("readiness")} subtitle={t("source_diligence_reports_onboarding_remediat")}>
              <CompanyReadinessPanel readiness={data.readiness} companyId={data.company.id} />
            </PageSection>
            <PageSection title={t("compliance")} subtitle={t("source_compliance_events")}>
              <CompanyCompliancePanel compliance={data.compliance} companyId={data.company.id} />
            </PageSection>
          </div>

          <PageSection title={t("documents_diligence")} subtitle={t("source_documents_diligence_reports")}>
            <CompanyDocumentsPanel documents={data.documents} companyId={data.company.id} />
          </PageSection>

          <PageSection title={t("business_plan")} subtitle={t("founder_s_ai_assisted_plan_sections_projecti")}>
            <CompanyBusinessPlanPanel companyId={data.company.id} />
          </PageSection>

          <PageSection title={t("cap_table")} subtitle={t("founder_s_shareholders_ownership_split_and_m")}>
            <CompanyCapTablePanel companyId={data.company.id} />
          </PageSection>

          {reviewMarketplace}
        </div>
      ) : null}

      {/* ---------- DEPLOY ---------- */}
      {tab === "deploy" ? (
        <div className="space-y-6">
          {reviewMarketplace}
          {investablePanel}
          {investorActivity}
          {spvOperations}
        </div>
      ) : null}

      {/* ---------- REVIEW ---------- */}
      {tab === "review" ? <div className="space-y-6">{reviewMarketplace}</div> : null}

      {/* ---------- OPTIMIZE ---------- */}
      {tab === "optimize" ? (
        <div className="space-y-6">
          {investorActivity}
          {spvOperations}
        </div>
      ) : null}

      {/* ---------- ANALYTICS & TOOLS ---------- */}
      {tab === "tools" ? (
        <div className="space-y-6">
          {riskSignals.length > 0 ? (
            <PageSection title={t("predictive_insights")} subtitle={t("rules_based_risk_signals_phase_1")}>
              <RiskSignalsPanel
                signals={riskSignals}
                maxItems={3}
                title={t("company_risk_signals")}
                subtitle={t("deterministic_rules_no_auto_approvals_or_wor")}
              />
            </PageSection>
          ) : null}

          <PageSection title={t("ai_company_assessment_2")} subtitle={t("structured_review_recommendation_strengths_c")}>
            <AdminCompanyAIAssessment companyId={data.company.id} />
          </PageSection>

          <PageSection title={t("operational_timeline")} subtitle={t("company_scoped_events_from_operational_activ")}>
            <CompanyTimelinePanel items={data.timeline} companyId={data.company.id} />
          </PageSection>

          <PageSection title={t("team_discussion")} subtitle={t("entity_scoped_comments_not_investor_messagin")}>
            <CollaborationDiscussionPanel entityType="company" entityId={data.company.id} title={t("company_discussion")} />
          </PageSection>

          <PageSection title={t("reports_exports")} subtitle={t("pre_filtered_admin_report_links")}>
            <CompanyWorkspaceReportsPanel companyId={data.company.id} companyName={data.company.company_name} />
          </PageSection>
        </div>
      ) : null}

      {/* ---------- SETTINGS ---------- */}
      {tab === "settings" ? (
        <div className="space-y-6">
          <PageSection title="Notifications" subtitle="Choose which events notify you and how">
            <NotificationSettings />
          </PageSection>
        </div>
      ) : null}
    </div>
  );
}
