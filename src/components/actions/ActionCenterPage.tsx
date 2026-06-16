"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ActionAnalyticsStrip } from "@/components/actions/ActionAnalyticsStrip";
import { InvestorActionAnalyticsCards } from "@/components/actions/InvestorActionAnalyticsCards";
import { ActionBulkToolbar } from "@/components/actions/ActionBulkToolbar";
import { ActionCard } from "@/components/actions/ActionCard";
import { ActionDetailDrawer } from "@/components/actions/ActionDetailDrawer";
import { ActionEmptyState } from "@/components/actions/ActionEmptyState";
import { ActionFilters } from "@/components/actions/ActionFilters";
import { ActionTable } from "@/components/actions/ActionTable";
import { ActionCenterScheduledStrip } from "@/components/actions/ActionCenterScheduledStrip";
import { WorkflowDependencyPanel } from "@/components/workflow/WorkflowDependencyPanel";
import type { WorkflowDependency } from "@/lib/automation/types";
import { ActionTabs } from "@/components/actions/ActionTabs";
import type { ActionCenterScheduledContext } from "@/lib/notifications/scheduled/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { useActionCenterFilters } from "@/hooks/use-action-center-filters";
import { useViewMode } from "@/hooks/use-view-mode";
import type { ActionCenterAnalytics, BulkActionType } from "@/lib/actions/types";
import type { NextBestAction, NextBestActionRole } from "@/lib/next-best-actions/types";
import { NBA_DISCLAIMER } from "@/lib/next-best-actions/types";

// ─── Priority-grouped list view ──────────────────────────────────────────────

const PRIORITY_CONF = {
  critical: { label: "Critical", dot: "#A32D2D", headerBg: "#FEF2F2", border: "#FCA5A5", ctaBg: "#FCEBEB", ctaColor: "#A32D2D", cta: "Resolve" },
  high:     { label: "High",     dot: "#854F0B", headerBg: "#FFFBEB", border: "#FCD34D", ctaBg: "#FEF3CD", ctaColor: "#854F0B", cta: "Review"  },
  medium:   { label: "Medium",   dot: "#534AB7", headerBg: "#EEF2FF", border: "#A5B4FC", ctaBg: "#EEEDFB", ctaColor: "#534AB7", cta: "Open"    },
  normal:   { label: "Normal",   dot: "#475569", headerBg: "#F8FAFC", border: "#CBD5E1", ctaBg: "#F1F5F9", ctaColor: "#475569", cta: "Open"    },
  low:      { label: "Low",      dot: "#94a3b8", headerBg: "#F8FAFC", border: "#E2E8F0", ctaBg: "#F1F5F9", ctaColor: "#94a3b8", cta: "Open"    },
} as const;

function PriorityGroupedList({
  actions,
  onOpen,
}: Readonly<{
  actions: NextBestAction[];
  onOpen: (id: string | null) => void;
}>) {
  type PKey = keyof typeof PRIORITY_CONF;
  const ORDER: PKey[] = ["critical", "high", "medium", "normal", "low"];

  const groups = ORDER.map((p) => ({
    ...PRIORITY_CONF[p],
    key: p,
    items: actions.filter((a) => (a.priority ?? "normal") === p),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={group.key}
          style={{
            overflow: "hidden",
            borderRadius: 12,
            border: `0.5px solid ${group.border}`,
            boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)",
          }}
        >
          {/* Group header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: group.headerBg,
              borderBottom: `0.5px solid ${group.border}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: group.dot,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: group.dot,
              }}
            >
              {group.label}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: 500,
              }}
            >
              {group.items.length} {group.items.length === 1 ? "action" : "actions"}
            </span>
          </div>

          {/* Action rows */}
          <div style={{ background: "#ffffff" }}>
            {group.items.map((action, idx) => {
              const isOverdue =
                action.status === "overdue" ||
                (action.dueAt && new Date(action.dueAt).getTime() < Date.now());
              return (
                <div
                  key={action.persistedId ?? action.id}
                  onClick={() => onOpen(action.persistedId ?? null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 16px",
                    borderTop: idx === 0 ? "none" : "0.5px solid #f1f5f9",
                    borderLeft: `3px solid ${group.dot}`,
                    cursor: "pointer",
                    transition: "background 0.12s",
                    background: isOverdue ? (group.key === "critical" ? "#FEF2F2" : "#FFFBEB") : "#ffffff",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = group.headerBg; }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = isOverdue
                      ? group.key === "critical" ? "#FEF2F2" : "#FFFBEB"
                      : "#ffffff";
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Category chip + status */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 3, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "1px 6px",
                          borderRadius: 5,
                          background: group.headerBg,
                          color: group.dot,
                        }}
                      >
                        {action.category.replace(/_/g, " ")}
                      </span>
                      {action.status === "escalated" && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5, background: "#FEF3CD", color: "#854F0B" }}>
                          Escalated
                        </span>
                      )}
                      {isOverdue && action.status !== "overdue" && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5, background: "#FCEBEB", color: "#A32D2D" }}>
                          Overdue
                        </span>
                      )}
                    </div>
                    {/* Title */}
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0c2340", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {action.title}
                    </p>
                    {/* Reason / entity */}
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {action.reason ?? (action.entityType ? action.entityType.replace(/_/g, " ") : null) ?? action.category.replace(/_/g, " ")}
                    </p>
                  </div>

                  {/* Right side: due date + CTA */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {action.dueAt && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: isOverdue ? 600 : 400,
                          color: isOverdue ? "#A32D2D" : "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isOverdue ? "⚠ " : ""}
                        {new Date(action.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpen(action.persistedId ?? null); }}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        background: group.ctaBg,
                        color: group.ctaColor,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group.cta} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page types ───────────────────────────────────────────────────────────────

type ActionCenterPageProps = {
  role: NextBestActionRole;
  title?: string;
  description?: string;
};

function ActionCenterContent({ role, title, description }: Readonly<ActionCenterPageProps>) {
  const { filters, setFilters, setTab, clearFilters } = useActionCenterFilters();
  const [actions, setActions] = useState<NextBestAction[]>([]);
  const [needsAttention, setNeedsAttention] = useState<NextBestAction[]>([]);
  const [scheduled, setScheduled] = useState<ActionCenterScheduledContext | null>(null);
  const [analytics, setAnalytics] = useState<ActionCenterAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } = useViewMode(
    role === "admin" || role === "analyst" ? "admin-actions" : "admin-actions",
  );
  const [workflowDependencies, setWorkflowDependencies] = useState<WorkflowDependency[]>([]);

  const canEscalate = role === "admin" || role === "analyst";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", filters.tab);
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    if (filters.entityType) params.set("entityType", filters.entityType);
    const effectiveQ = query.trim() ? query.trim() : filters.q;
    if (effectiveQ) params.set("q", effectiveQ);
    if (filters.overdue) params.set("overdue", "true");
    if (filters.escalated) params.set("escalated", "true");
    if (filters.companyId) params.set("company", filters.companyId);
    if (filters.investorId) params.set("investor", filters.investorId);
    if (filters.spvId) params.set("spv", filters.spvId);
    params.set("limit", String(filters.limit));
    return params.toString();
  }, [filters, query]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/action-center?${queryString}`);
      if (!res.ok) throw new Error("Unable to load actions.");
      const data = (await res.json()) as {
        actions: NextBestAction[];
        needsAttention?: NextBestAction[];
        scheduled?: ActionCenterScheduledContext;
        workflowDependencies?: WorkflowDependency[];
        analytics: ActionCenterAnalytics;
        total: number;
      };
      setActions(data.actions ?? []);
      setNeedsAttention(data.needsAttention ?? []);
      setScheduled(data.scheduled ?? null);
      setWorkflowDependencies(data.workflowDependencies ?? []);
      setAnalytics(data.analytics ?? null);
      setTotal(data.total ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load actions.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- refresh action list when filters change */
    void refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(actions.map((a) => a.persistedId).filter(Boolean) as string[]));
  }

  async function handleBulk(operation: BulkActionType) {
    if (selectedIds.size === 0) return;
    setBulkPending(true);
    const previous = actions;
    setActions((items) => items.filter((item) => !item.persistedId || !selectedIds.has(item.persistedId)));

    try {
      const res = await fetch("/api/action-center/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIds: [...selectedIds], operation }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Bulk update failed.");
      }
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      setActions(previous);
      setError(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Action Intelligence"
        title={title ?? "Action Center"}
        description={description ?? "Cross-workflow operational actions with lifecycle tracking."}
      />

      {analytics ? (
        role === "investor" ? (
          <InvestorActionAnalyticsCards analytics={analytics} actions={actions} />
        ) : (
          <ActionAnalyticsStrip analytics={analytics} role={role} />
        )
      ) : null}

      {scheduled ? <ActionCenterScheduledStrip scheduled={scheduled} /> : null}

      {workflowDependencies.length > 0 ? (
        <WorkflowDependencyPanel dependencies={workflowDependencies} title="Workflow blockers" />
      ) : null}

      <ActionTabs
        active={filters.tab}
        onChange={setTab}
        counts={
          analytics
            ? {
                active: analytics.open,
                overdue: analytics.overdue,
                escalated: analytics.escalated,
                completed: analytics.completedThisWeek,
                snoozed: analytics.snoozed,
              }
            : undefined
        }
      />

      {needsAttention.length > 0 && filters.tab === "active" ? (
        <section className="rounded-xl border border-rose-200/80 bg-rose-50/30 p-4">
          <h3 className="text-sm font-semibold text-rose-950">Needs attention</h3>
          <p className="mt-1 text-xs text-rose-800/90">Overdue, escalated, blocked, or critical workflow items.</p>
          <ul className="mt-3 space-y-2">
            {needsAttention.map((action) => (
              <li key={action.persistedId ?? action.id}>
                <ActionCard
                  action={action}
                  selected={action.persistedId ? selectedIds.has(action.persistedId) : false}
                  onSelect={(checked) => action.persistedId && toggleSelect(action.persistedId, checked)}
                  onOpen={() => setDetailId(action.persistedId ?? null)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ActionFilters filters={filters} onChange={setFilters} onClear={clearFilters} />

      {role !== "investor" ? (
        <ViewToolbar
          viewMode={viewMode}
          allowedModes={allowedModes}
          onViewModeChange={setViewMode}
          density={density}
          onDensityChange={setDensity}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search actions, entities, or categories…"
          showViewMode={false}
          showDensity={false}
          showSavedViews={false}
          sticky
        />
      ) : null}

      <ActionBulkToolbar
        selectedCount={selectedIds.size}
        canEscalate={canEscalate}
        disabled={bulkPending}
        onBulk={handleBulk}
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {actions.length} of {total} actions
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading actions…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : actions.length === 0 ? (
        <ActionEmptyState />
      ) : viewMode === "table" ? (
        <ActionTable
          actions={actions}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          onToggleAll={toggleAll}
          onOpen={(action) => setDetailId(action.persistedId ?? null)}
        />
      ) : (
        <PriorityGroupedList actions={actions} onOpen={(id) => setDetailId(id)} />
      )}

      <p className="text-[10px] text-slate-500">{NBA_DISCLAIMER}</p>

      <ActionDetailDrawer
        actionId={detailId}
        canEscalate={canEscalate}
        viewerRole={role}
        onClose={() => setDetailId(null)}
        onUpdated={() => void refresh()}
      />
    </div>
  );
}

export function ActionCenterPage(props: Readonly<ActionCenterPageProps>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading action center…</p>}>
      <ActionCenterContent {...props} />
    </Suspense>
  );
}
