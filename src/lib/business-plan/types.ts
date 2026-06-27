import type { ProjectionAssumptions, ProjectionResult } from "./projections";

export type BusinessPlanStatus = "draft" | "finalized";

export interface BusinessPlanSectionContent {
  content: string;
  aiGenerated: boolean;
}

export interface BusinessPlan {
  id: string;
  companyId: string;
  /** sectionId → content */
  sections: Record<string, BusinessPlanSectionContent>;
  assumptions: Partial<ProjectionAssumptions>;
  projections: ProjectionResult | null;
  execSummary: string | null;
  status: BusinessPlanStatus;
  aiAssisted: boolean;
  generatedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string | null;
}
