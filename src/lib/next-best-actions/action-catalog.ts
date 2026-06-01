import type {
  NextBestAction,
  NextBestActionCategory,
  NextBestActionPriority,
  NextBestActionRole,
} from "@/lib/next-best-actions/types";

export function buildActionId(parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

type CreateActionInput = {
  id: string;
  role: NextBestActionRole;
  title: string;
  description: string;
  priority: NextBestActionPriority;
  category: NextBestActionCategory;
  entityType: string;
  entityId?: string;
  companyId?: string;
  investorId?: string;
  spvId?: string;
  href: string;
  sourceModule: string;
  reason: string;
  blockers?: string[];
  createdFrom: string;
  metadata?: Record<string, unknown>;
  urgencyAt?: string;
};

export function createNextBestAction(input: CreateActionInput): NextBestAction {
  return {
    id: input.id,
    role: input.role,
    title: input.title,
    description: input.description,
    priority: input.priority,
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId,
    companyId: input.companyId,
    investorId: input.investorId,
    spvId: input.spvId,
    href: input.href,
    sourceModule: input.sourceModule,
    reason: input.reason,
    blockers: input.blockers ?? [],
    createdFrom: input.createdFrom,
    metadata: input.metadata ?? {},
    urgencyAt: input.urgencyAt,
  };
}
