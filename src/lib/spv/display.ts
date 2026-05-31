import type {
  SpvChecklistCategory,
  SpvChecklistItemRecord,
  SpvChecklistItemStatus,
  SpvParticipationRecord,
} from "@/lib/spv/types";

const DONE_CHECKLIST_STATUSES: SpvChecklistItemStatus[] = ["completed", "waived"];

export function formatSpvCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function getSpvParticipationTotals(participations: SpvParticipationRecord[]) {
  const active = participations.filter((row) => !["declined", "canceled"].includes(row.status));
  const indicativeTotal = active.reduce((sum, row) => sum + (Number(row.indicative_amount) || 0), 0);
  return {
    participantCount: active.length,
    indicativeTotal,
    softCommittedCount: active.filter((row) => row.status === "soft_committed").length,
  };
}

export function computeChecklistReadinessPct(items: SpvChecklistItemRecord[]) {
  if (items.length === 0) {
    return 0;
  }
  const done = items.filter((row) =>
    DONE_CHECKLIST_STATUSES.includes(row.status as SpvChecklistItemStatus),
  ).length;
  return Math.round((done / items.length) * 100);
}

export function areRequiredChecklistItemsComplete(items: SpvChecklistItemRecord[]) {
  const required = items.filter((row) => row.required);
  if (required.length === 0) {
    return true;
  }
  return required.every((row) =>
    DONE_CHECKLIST_STATUSES.includes(row.status as SpvChecklistItemStatus),
  );
}

export function summarizeChecklistByCategory(items: SpvChecklistItemRecord[]) {
  const map = new Map<
    SpvChecklistCategory,
    { category: SpvChecklistCategory; total: number; completed: number }
  >();

  for (const row of items) {
    const category = row.category as SpvChecklistCategory;
    const entry = map.get(category) ?? { category, total: 0, completed: 0 };
    entry.total += 1;
    if (DONE_CHECKLIST_STATUSES.includes(row.status as SpvChecklistItemStatus)) {
      entry.completed += 1;
    }
    map.set(category, entry);
  }

  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category));
}

export function formatChecklistCategory(category: string) {
  return category.replace(/_/g, " ");
}

export function investorPreparationLabel(
  readinessPct: number | null | undefined,
  documentReadyAt: string | null | undefined,
) {
  const pct = readinessPct ?? 0;
  if (documentReadyAt || pct >= 100) {
    return "Document-ready (operational)";
  }
  if (pct > 0) {
    return "In preparation";
  }
  return "Preparation pending";
}
