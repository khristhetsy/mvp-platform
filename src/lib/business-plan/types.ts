import type { ProjectionAssumptions, ProjectionResult } from "./projections";

export type BusinessPlanStatus = "draft" | "finalized";

export interface BusinessPlanSectionNa {
  /** Optional reason, shown wherever the section appears (editor, export, stage page). */
  note: string | null;
  /** ISO time it was marked. */
  at: string;
}

export interface BusinessPlanSectionContent {
  content: string;
  aiGenerated: boolean;
  /** Set when the founder marked this section N/A. N/A counts as done. */
  notApplicable?: BusinessPlanSectionNa | null;
}

export interface BusinessPlan {
  id: string;
  companyId: string;
  /** sectionId → content */
  sections: Record<string, BusinessPlanSectionContent>;
  assumptions: Partial<ProjectionAssumptions>;
  projections: ProjectionResult | null;
  execSummary: string | null;
  charts: Record<string, unknown>;
  status: BusinessPlanStatus;
  aiAssisted: boolean;
  generatedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string | null;
}
