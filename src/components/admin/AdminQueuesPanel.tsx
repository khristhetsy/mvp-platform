"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSearchBar } from "@/components/ui/FilterSearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { PageSection } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { drilldownFocusClass, drilldownHoverClass } from "@/components/ui/drilldown";
import type { AdminQueueItem, AdminQueueSummaryItem, AdminQueueType, AdminQueuesSnapshot } from "@/lib/queues/admin-queues";
import { ADMIN_QUEUE_TYPES } from "@/lib/queues/admin-queues";
import {
  QUEUE_EMPTY_COPY,
  QUEUE_TYPE_LABELS,
  formatQueueAge,
  formatQueueMetadataHint,
  formatQueueStatus,
  formatQueueTimestamp,
  isAdminQueueType,
  queueSeverityToStatus,
} from "@/lib/queues/queue-display";

export function AdminQueuesPanel({
  snapshot,
  initialQueue,
  initialInvestor,
  initialSpv,
}: Readonly<{
  snapshot: AdminQueuesSnapshot;
  initialQueue?: string;
  initialInvestor?: string;
  initialSpv?: string;
}>) {
  const [activeQueue, setActiveQueue] = useState<AdminQueueType>(
    isAdminQueueType(initialQueue) ? initialQueue : "company_reviews",
  );
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const investorFilter = initialInvestor?.trim() || null;
  const spvFilter = initialSpv?.trim() || null;

  const items = useMemo(() => {
    let rows = snapshot.itemsByQueue[activeQueue] ?? [];
    if (investorFilter) {
      rows = rows.filter((row) => row.investor_id === investorFilter);
    }
    if (spvFilter) {
      rows = rows.filter((row) => row.spv_id === spvFilter);
    }
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        [row.title, row.subtitle, row.status, row.next_action_label]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      );
    }
    if (severityFilter !== "all") {
      rows = rows.filter((row) => row.severity === severityFilter);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    return rows;
  }, [activeQueue, investorFilter, spvFilter, search, severityFilter, snapshot.itemsByQueue, statusFilter]);

  const severities = useMemo(
    () => [...new Set((snapshot.itemsByQueue[activeQueue] ?? []).map((row) => row.severity))].sort(),
    [activeQueue, snapshot.itemsByQueue],
  );
  const statuses = useMemo(
    () => [...new Set((snapshot.itemsByQueue[activeQueue] ?? []).map((row) => row.status))].sort(),
    [activeQueue, snapshot.itemsByQueue],
  );

  return (
    <div className="space-y-8">
      <PageSection title="Queue summary" subtitle="Live operational counts across CapitalOS">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {snapshot.summary.map((card) => (
            <QueueSummaryCard
              key={card.queue_type}
              card={card}
              active={activeQueue === card.queue_type}
              onSelect={() => setActiveQueue(card.queue_type)}
            />
          ))}
        </div>
      </PageSection>

      <WorkspacePanel
        title={QUEUE_TYPE_LABELS[activeQueue]}
        subtitle={`${items.length} item${items.length === 1 ? "" : "s"} shown · routes into existing admin modules`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {ADMIN_QUEUE_TYPES.map((queueType) => (
              <button
                key={queueType}
                type="button"
                onClick={() => setActiveQueue(queueType)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeQueue === queueType
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {QUEUE_TYPE_LABELS[queueType]}
              </button>
            ))}
          </div>
          <FilterSearchBar value={search} onChange={setSearch} placeholder="Search queue items…" />
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All severities</option>
            {severities.map((severity) => (
              <option key={severity} value={severity}>
                {formatQueueStatus(severity)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {formatQueueStatus(status)}
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={QUEUE_EMPTY_COPY[activeQueue].title}
            description={QUEUE_EMPTY_COPY[activeQueue].description}
          />
        ) : (
          <DataTable density="compact">
            <DataTableHead>
              <DataTableHeaderCell>Item</DataTableHeaderCell>
              <DataTableHeaderCell>Severity</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Age</DataTableHeaderCell>
              <DataTableHeaderCell>Next action</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {items.map((item) => (
                <QueueItemRow key={item.id} item={item} />
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </WorkspacePanel>
    </div>
  );
}

function QueueSummaryCard({
  card,
  active,
  onSelect,
}: Readonly<{
  card: AdminQueueSummaryItem;
  active: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left shadow-[var(--shadow-panel)] transition ${
        active ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200/80 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{card.label}</p>
        {card.count > 0 ? <StatusBadge label={String(card.count)} status={card.status} /> : null}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">{card.count}</p>
      <p className="mt-1 text-xs text-slate-600">{card.detail}</p>
    </button>
  );
}

function QueueItemRow({ item }: Readonly<{ item: AdminQueueItem }>) {
  const hint = formatQueueMetadataHint(item);

  return (
    <DataTableRow>
      <DataTableCell>
        <Link
          href={item.href}
          className={`group block no-underline ${drilldownHoverClass} ${drilldownFocusClass}`}
        >
          <p className="font-medium text-slate-900 group-hover:text-[var(--navy)]">{item.title}</p>
          {item.subtitle ? <p className="text-xs text-slate-600">{item.subtitle}</p> : null}
          {hint ? <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{hint}</p> : null}
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{formatQueueTimestamp(item.created_at)}</p>
        </Link>
      </DataTableCell>
      <DataTableCell>
        <StatusBadge label={formatQueueStatus(item.severity)} status={queueSeverityToStatus(item.severity)} dot />
      </DataTableCell>
      <DataTableCell>{formatQueueStatus(item.status)}</DataTableCell>
      <DataTableCell className="font-mono text-xs">{formatQueueAge(item.created_at)}</DataTableCell>
      <DataTableCell>
        <Link href={item.href} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          {item.next_action_label}
        </Link>
      </DataTableCell>
    </DataTableRow>
  );
}
