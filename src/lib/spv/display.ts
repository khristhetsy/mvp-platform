import type { SpvParticipationRecord } from "@/lib/spv/types";

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
