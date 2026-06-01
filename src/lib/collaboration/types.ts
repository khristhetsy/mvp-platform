export const COLLABORATION_ENTITY_TYPES = [
  "company",
  "investor",
  "spv",
  "action",
  "queue",
] as const;

export type CollaborationEntityType = (typeof COLLABORATION_ENTITY_TYPES)[number];

export const COLLABORATION_VISIBILITIES = [
  "admin_only",
  "internal",
  "company_team",
  "investor_related",
] as const;

export type CollaborationVisibility = (typeof COLLABORATION_VISIBILITIES)[number];

export type CollaborationMention = {
  type: "user";
  label: string;
  userId?: string | null;
};

export type CollaborationCommentView = {
  id: string;
  threadId: string;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  body: string;
  visibility: CollaborationVisibility;
  isInternalNote: boolean;
  mentions: CollaborationMention[];
  createdAt: string;
  updatedAt: string;
};

export type CollaborationThreadContext = {
  companyId?: string | null;
  investorProfileId?: string | null;
  spvId?: string | null;
};

export type CreateCollaborationCommentInput = {
  entityType: CollaborationEntityType;
  entityId: string;
  body: string;
  visibility: CollaborationVisibility;
  isInternalNote?: boolean;
  threadContext?: CollaborationThreadContext;
};
