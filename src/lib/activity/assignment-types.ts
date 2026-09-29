/**
 * The shapes the assignment screens render, with no server code attached.
 *
 * `assignments.ts` carries `import "server-only"` because it uses the
 * service-role client. Three client components need these types; a type-only
 * import does erase, but one future edit turning it into a value import breaks
 * the build in a way that is annoying to diagnose. Keeping the shapes here
 * makes the boundary structural instead of a convention.
 */
import type { ActivityAudience, ActivityStage } from "@/lib/activity/stages";

export type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isSuperAdmin: boolean;
  initials: string;
};

export type StageAssignment = {
  audience: ActivityAudience;
  stage: ActivityStage;
  userIds: string[];
  /** Named in the alert; the escalation clock starts from them. */
  leadUserId: string | null;
  escalateAfterMinutes: number | null;
  escalateToUserId: string | null;
};

export type StageAssignmentBoard = {
  staff: StaffMember[];
  stages: StageAssignment[];
};
