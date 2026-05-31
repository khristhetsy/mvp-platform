import type {
  SpvParticipationRequirementRecord,
  SpvParticipationRequirementStatus,
  SpvParticipationRequirementCategory,
} from "@/lib/spv/types";

const DONE_REQUIREMENT_STATUSES: SpvParticipationRequirementStatus[] = ["approved", "waived"];

export function computeParticipationReadinessPct(items: SpvParticipationRequirementRecord[]) {
  if (items.length === 0) {
    return 0;
  }
  const done = items.filter((row) =>
    DONE_REQUIREMENT_STATUSES.includes(row.status as SpvParticipationRequirementStatus),
  ).length;
  return Math.round((done / items.length) * 100);
}

export function areRequiredParticipationRequirementsComplete(
  items: SpvParticipationRequirementRecord[],
) {
  const required = items.filter((row) => row.required);
  if (required.length === 0) {
    return true;
  }
  return required.every((row) =>
    DONE_REQUIREMENT_STATUSES.includes(row.status as SpvParticipationRequirementStatus),
  );
}

export function formatParticipationRequirementCategory(category: string) {
  return category.replace(/_/g, " ");
}

export function groupRequirementsByParticipation(
  requirements: SpvParticipationRequirementRecord[],
) {
  const map = new Map<string, SpvParticipationRequirementRecord[]>();
  for (const row of requirements) {
    const list = map.get(row.spv_participation_id) ?? [];
    list.push(row);
    map.set(row.spv_participation_id, list);
  }
  return map;
}
