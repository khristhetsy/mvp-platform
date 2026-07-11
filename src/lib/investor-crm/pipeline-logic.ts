export const INVESTOR_PIPELINE_STAGES = ["prospect", "outreach", "engaged", "diligence", "committed"] as const;

export type InvestorPipelineStage = (typeof INVESTOR_PIPELINE_STAGES)[number];

export const INVESTOR_PIPELINE_STAGE_LABEL: Record<InvestorPipelineStage, string> = {
  prospect: "Prospect",
  outreach: "Outreach",
  engaged: "Engaged",
  diligence: "Diligence",
  committed: "Committed",
};

export type AdminPipelineUpdateInput = {
  stage?: InvestorPipelineStage;
  probability?: number;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  clearFollowUp?: boolean;
  markContacted?: boolean;
  lastContactedAt?: string;
  ownerAdminId?: string;
  clearOwner?: boolean;
};

export type AdminPipelineDbPatch = {
  updated_at: string;
  stage?: InvestorPipelineStage;
  probability?: number;
  notes?: string | null;
  next_follow_up_at?: string | null;
  last_contacted_at?: string;
  owner_admin_id?: string | null;
};

export function buildAdminPipelineUpdatePatch(input: AdminPipelineUpdateInput, now = new Date()): AdminPipelineDbPatch {
  const patch: AdminPipelineDbPatch = { updated_at: now.toISOString() };

  if (input.stage && INVESTOR_PIPELINE_STAGES.includes(input.stage)) {
    patch.stage = input.stage;
  }

  if (typeof input.probability === "number" && input.probability >= 0 && input.probability <= 100) {
    patch.probability = input.probability;
  }

  if (typeof input.notes === "string") {
    patch.notes = input.notes.trim() || null;
  }

  if (input.nextFollowUpAt === null || input.clearFollowUp === true) {
    patch.next_follow_up_at = null;
  } else if (typeof input.nextFollowUpAt === "string" && input.nextFollowUpAt.length > 0) {
    patch.next_follow_up_at = input.nextFollowUpAt;
  }

  if (input.markContacted === true) {
    patch.last_contacted_at = now.toISOString();
  } else if (typeof input.lastContactedAt === "string" && input.lastContactedAt.length > 0) {
    patch.last_contacted_at = input.lastContactedAt;
  }

  if (typeof input.ownerAdminId === "string" && input.ownerAdminId.length > 0) {
    patch.owner_admin_id = input.ownerAdminId;
  } else if (input.clearOwner === true) {
    patch.owner_admin_id = null;
  }

  return patch;
}

export function isPipelineFollowUpDue(nextFollowUpAt: string | null | undefined, now = new Date()) {
  if (!nextFollowUpAt) {
    return false;
  }

  return new Date(nextFollowUpAt).getTime() <= now.getTime();
}

export type AdminPipelineFilterRow = {
  id: string;
  investor_id: string;
  company_id: string;
  stage: string;
  next_follow_up_at: string | null;
  investor_name: string | null;
  investor_email: string | null;
  company_name: string | null;
  notes: string | null;
};

export function filterAdminPipelineRows<T extends AdminPipelineFilterRow>(
  rows: T[],
  filters: {
    followUpDueOnly?: boolean;
    stage?: string;
    companyId?: string;
    investorId?: string;
    q?: string;
  },
  now = new Date(),
): T[] {
  let result = rows;

  if (filters.followUpDueOnly === true) {
    result = result.filter((row) => isPipelineFollowUpDue(row.next_follow_up_at, now));
  }

  if (filters.stage && INVESTOR_PIPELINE_STAGES.includes(filters.stage as InvestorPipelineStage)) {
    result = result.filter((row) => row.stage === filters.stage);
  }

  if (filters.companyId) {
    result = result.filter((row) => row.company_id === filters.companyId);
  }

  if (filters.investorId) {
    result = result.filter((row) => row.investor_id === filters.investorId);
  }

  const q = filters.q?.trim().toLowerCase() ?? "";
  if (q.length > 0) {
    result = result.filter((row) => {
      const haystack = [row.investor_name, row.investor_email, row.company_name, row.notes, row.stage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return result;
}
