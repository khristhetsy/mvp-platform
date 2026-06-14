"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { auditEntityHref } from "@/lib/audit-compliance/filters";
import { auditSourceLabel, formatAuditTimestamp, severityBadgeStatus } from "@/lib/audit-compliance/display";
import type {
  AuditEvidenceEntityType,
  AuditRiskSummary,
  AuditTimelineEntry,
  ComplianceEvidencePack,
} from "@/lib/audit-compliance/types";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useViewMode } from "@/hooks/use-view-mode";

function RiskCard({ label, value, status }: Readonly<{ label: string; value: number; status?: "danger" | "warning" | "neutral" }>) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{value}</p>
      {status && value > 0 ? (
        <div className="mt-1">
          <StatusBadge label="Attention" status={status} dot />
        </div>
      ) : null}
    </div>
  );
}

function getEntryHref(entry: AuditTimelineEntry): string {
  if (entry.companyId) return `/admin/companies/${entry.companyId}`;
  if (entry.investorId) return `/admin/investors/${entry.investorId}`;
  if (entry.spvId) return `/admin/spvs`;
  if (entry.entityType && entry.entityId) {
    return auditEntityHref(entry.entityType as AuditEvidenceEntityType, entry.entityId);
  }
  return `/admin/audit?module=${encodeURIComponent(entry.sourceModule)}`;
}

function TimelineTable({ entries }: Readonly<{ entries: AuditTimelineEntry[] }>) {
  if (!entries.length) {
    return <p className="text-sm text-slate-600">No timeline events match these filters.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Module</th>
            <th className="px-3 py-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { window.location.href = getEntryHref(entry); }}>
              <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatAuditTimestamp(entry.createdAt)}</td>
              <td className="px-3 py-2">{auditSourceLabel(entry.source)}</td>
              <td className="px-3 py-2">
                <p className="font-medium text-slate-900">{entry.title}</p>
                <p className="font-mono text-[10px] text-slate-500">{entry.eventType}</p>
              </td>
              <td className="px-3 py-2">
                <StatusBadge label={entry.severity} status={severityBadgeStatus(entry.severity)} />
              </td>
              <td className="px-3 py-2 text-slate-600">{entry.sourceModule}</td>
              <td className="px-3 py-2">
                <a
                  href={getEntryHref(entry)}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  View →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAuditCenter({
  timeline,
  riskSummary,
  evidencePack,
  initialEntityType,
  initialEntityId,
}: Readonly<{
  timeline: AuditTimelineEntry[];
  riskSummary: AuditRiskSummary;
  evidencePack: ComplianceEvidencePack | null;
  initialEntityType?: string;
  initialEntityId?: string;
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewMode, density, setViewMode, setDensity, allowedModes } = useViewMode("admin-audit");
  const [entityType, setEntityType] = useState(initialEntityType ?? "company");
  const [entityId, setEntityId] = useState(initialEntityId ?? "");
  const [exporting, setExporting] = useState(false);

  const filterQuery = useMemo(() => searchParams.toString(), [searchParams]);

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`/admin/audit?${params.toString()}`);
  }

  async function handleExport(format: "json" | "csv") {
    setExporting(true);
    try {
      const params = new URLSearchParams(filterQuery);
      params.set("format", format);
      if (entityId.trim()) {
        params.set("entityType", entityType);
        params.set("entityId", entityId.trim());
      }
      const res = await fetch(`/api/admin/audit/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "csv"
          ? `capitalos-audit-${new Date().toISOString().slice(0, 10)}.csv`
          : `capitalos-audit-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Unable to export audit package.");
    } finally {
      setExporting(false);
    }
  }

  function loadEvidencePack() {
    if (!entityId.trim()) return;
    const params = new URLSearchParams(searchParams.toString());
    if (entityType === "company") params.set("company", entityId.trim());
    else if (entityType === "investor") params.set("investorProfile", entityId.trim());
    else params.set("spv", entityId.trim());
    params.set("evidenceType", entityType);
    params.set("evidenceId", entityId.trim());
    router.push(`/admin/audit?${params.toString()}`);
  }

  return (
    <div className="space-y-8">
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        showSearch={false}
        showSavedViews={false}
        sticky
      />

      {viewMode === "timeline" || viewMode === "table" ? null : (
      <PageSection title="Audit overview" subtitle="Operational traceability — not legal advice">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RiskCard label="Critical compliance" value={riskSummary.openCriticalCompliance} status="danger" />
          <RiskCard label="Overdue actions" value={riskSummary.overdueActions} status="warning" />
          <RiskCard label="Escalated workflows" value={riskSummary.escalatedWorkflows} status="warning" />
          <RiskCard label="Failed automation today" value={riskSummary.failedAutomationRunsToday} status="warning" />
          <RiskCard label="Failed orchestration today" value={riskSummary.failedOrchestrationRunsToday} />
          <RiskCard label="Failed imports today" value={riskSummary.failedImportsToday} />
          <RiskCard label="SPV blockers" value={riskSummary.unresolvedSpvBlockers} />
          <RiskCard label="Repeat-flag companies" value={riskSummary.companiesWithRepeatedFlags} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Trace model: Event → Review → Action → Resolution → Audit evidence. No document bodies or message content.
        </p>
      </PageSection>
      )}

      <PageSection title="Compliance timeline" subtitle="Aggregated staff-visible audit trail">
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            value={searchParams.get("severity") ?? ""}
            onChange={(e) => updateFilter("severity", e.target.value || null)}
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="info">Info</option>
          </select>
          <input
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            placeholder="Event type filter"
            defaultValue={searchParams.get("eventType") ?? ""}
            onBlur={(e) => updateFilter("eventType", e.target.value.trim() || null)}
          />
          <input
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            placeholder="Source module"
            defaultValue={searchParams.get("module") ?? ""}
            onBlur={(e) => updateFilter("module", e.target.value.trim() || null)}
          />
        </div>
        <TimelineTable entries={timeline} />
      </PageSection>

      {viewMode === "timeline" || viewMode === "table" ? null : (
      <PageSection title="Evidence pack" subtitle="Entity-scoped audit evidence (sanitized)">
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            <option value="company">Company</option>
            <option value="investor">Investor profile</option>
            <option value="spv">SPV</option>
          </select>
          <input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Entity UUID"
            className="min-w-[240px] rounded-md border border-slate-200 px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={loadEvidencePack}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900"
          >
            Build evidence pack
          </button>
        </div>
        {evidencePack ? (
          <div className="mt-4 space-y-3 rounded-xl border border-indigo-200/60 bg-indigo-50/20 p-4 text-xs">
            <p className="font-semibold text-indigo-950">
              {evidencePack.entityType} · {evidencePack.entityId.slice(0, 8)}…
            </p>
            <ul className="grid gap-1 text-slate-700 sm:grid-cols-2">
              <li>Timeline events: {evidencePack.summary.timelineEventCount}</li>
              <li>Open compliance: {evidencePack.summary.openComplianceCount}</li>
              <li>Actions: {evidencePack.summary.actionCount}</li>
              <li>Collaboration comments: {evidencePack.summary.collaborationCommentCount}</li>
              <li>Automation runs: {evidencePack.summary.automationRunCount}</li>
              <li>Report exports: {evidencePack.summary.reportExportCount}</li>
            </ul>
            <Link
              href={auditEntityHref(evidencePack.entityType, evidencePack.entityId)}
              className="inline-block font-semibold text-indigo-700 hover:underline"
            >
              Permalink to filtered audit view
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-600">Select an entity to build an evidence summary.</p>
        )}
      </PageSection>
      )}

      <PageSection title="Automation & orchestration" subtitle="From timeline sources">
        <p className="text-xs text-slate-600">
          Filter timeline by module <span className="font-mono">workflow_automation</span> or{" "}
          <span className="font-mono">orchestration</span> for run history.
        </p>
      </PageSection>

      <PageSection title="Import / export audit" subtitle="Import batches and report generation logs">
        <p className="text-xs text-slate-600">
          Import batches and <span className="font-mono">admin.report_generated</span> entries appear in the timeline.
          Use Export below for a downloadable package.
        </p>
      </PageSection>

      <PageSection title="Collaboration audit" subtitle="Comment metadata only — no bodies">
        {evidencePack ? (
          <p className="text-xs text-slate-700">
            Threads: {evidencePack.collaborationSummary.threadCount} · Comments:{" "}
            {evidencePack.collaborationSummary.commentCount}
          </p>
        ) : (
          <p className="text-xs text-slate-600">Build an evidence pack to see collaboration counts by visibility.</p>
        )}
      </PageSection>

      <PageSection title="Export audit package" subtitle="JSON or CSV · writes audit_logs">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport("json")}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            Export JSON
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport("csv")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
          >
            Export CSV
          </button>
        </div>
      </PageSection>
    </div>
  );
}
