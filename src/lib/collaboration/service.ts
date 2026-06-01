import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEntityAccess } from "@/lib/collaboration/access";
import { parseMentions } from "@/lib/collaboration/mentions";
import type {
  CollaborationCommentView,
  CollaborationEntityType,
  CreateCollaborationCommentInput,
} from "@/lib/collaboration/types";
import {
  allowedVisibilitiesForRole,
  canViewComment,
  defaultVisibilityForRole,
  isStaffRole,
} from "@/lib/collaboration/visibility";
import { bridgeCollaborationComment } from "@/lib/integrations/emit-bridge";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type { Database, Profile } from "@/lib/supabase/types";

const RECENT_LIMIT = 20;

async function getOrCreateThread(
  supabase: SupabaseClient<Database>,
  entityType: CollaborationEntityType,
  entityId: string,
  context: { companyId?: string | null; investorProfileId?: string | null; spvId?: string | null },
): Promise<string> {
  const { data: existing } = await supabase
    .from("collaboration_threads")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("collaboration_threads")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      company_id: context.companyId ?? null,
      investor_profile_id: context.investorProfileId ?? null,
      spv_id: context.spvId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Unable to create collaboration thread.");
  }

  return created.id;
}

export async function listCollaborationComments(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  entityType: CollaborationEntityType,
  entityId: string,
): Promise<CollaborationCommentView[]> {
  const access = await resolveEntityAccess(supabase, profile, entityType, entityId);
  if (!access.allowed) return [];

  const { data: thread } = await supabase
    .from("collaboration_threads")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (!thread?.id) return [];

  const { data: rows, error } = await supabase
    .from("collaboration_comments")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);

  if (error) throw new Error(error.message);

  const authorIds = [...new Set((rows ?? []).map((r) => r.author_user_id))];
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name, email, role").in("id", authorIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (rows ?? [])
    .filter((row) => canViewComment(profile, row.visibility as CollaborationCommentView["visibility"]))
    .map((row) => {
      const author = profileMap.get(row.author_user_id);
      const mentions = Array.isArray(row.mentions) ? row.mentions : [];
      return {
        id: row.id,
        threadId: row.thread_id,
        authorUserId: row.author_user_id,
        authorName: author?.full_name ?? author?.email ?? "User",
        authorRole: author?.role ?? "unknown",
        body: row.body,
        visibility: row.visibility as CollaborationCommentView["visibility"],
        isInternalNote: row.is_internal_note,
        mentions: mentions as CollaborationCommentView["mentions"],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
}

export async function createCollaborationComment(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  input: CreateCollaborationCommentInput,
): Promise<CollaborationCommentView> {
  const body = input.body.trim().slice(0, 4000);
  if (!body) throw new Error("Comment cannot be empty.");

  const access = await resolveEntityAccess(supabase, profile, input.entityType, input.entityId);
  if (!access.allowed) throw new Error("You do not have access to comment on this entity.");

  const allowed = allowedVisibilitiesForRole(profile.role);
  if (!allowed.includes(input.visibility)) {
    throw new Error("Invalid visibility for your role.");
  }

  if (input.isInternalNote && !isStaffRole(profile.role)) {
    throw new Error("Internal notes are staff-only.");
  }

  const threadContext = { ...access.context, ...input.threadContext };
  const threadId = await getOrCreateThread(supabase, input.entityType, input.entityId, threadContext);
  const mentions = parseMentions(body);

  const { data: row, error } = await supabase
    .from("collaboration_comments")
    .insert({
      thread_id: threadId,
      author_user_id: profile.id,
      body,
      visibility: input.visibility,
      mentions,
      is_internal_note: Boolean(input.isInternalNote),
    })
    .select("*")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Unable to save comment.");
  }

  await supabase
    .from("collaboration_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  bridgeCollaborationComment(
    input.entityType,
    input.entityId,
    threadContext.companyId ?? null,
  );

  emitOperationalEvent(supabase, {
    eventType: "comment_created",
    eventCategory: "system",
    entityType: input.entityType,
    entityId: input.entityId,
    actorUserId: profile.id,
    actorRole: profile.role,
    companyId: threadContext.companyId ?? null,
    investorId: threadContext.investorProfileId ?? null,
    spvId: threadContext.spvId ?? null,
    title: "Collaboration comment added",
    description: null,
    metadata: sanitizeOperationalMetadata({
      visibility: input.visibility,
      is_internal_note: input.isInternalNote ?? false,
    }),
    sourceModule: "collaboration",
    visibility: isStaffRole(profile.role) ? "admin_only" : profile.role === "founder" ? "founder" : "investor",
  });

  if (mentions.length > 0) {
    emitOperationalEvent(supabase, {
      eventType: "mention_created",
      eventCategory: "system",
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: profile.id,
      actorRole: profile.role,
      companyId: access.context.companyId ?? null,
      title: "Collaboration mention recorded",
      description: null,
      metadata: sanitizeOperationalMetadata({ mention_count: mentions.length }),
      sourceModule: "collaboration",
      visibility: "admin_only",
    });
  }

  return {
    id: row.id,
    threadId: row.thread_id,
    authorUserId: profile.id,
    authorName: profile.full_name ?? profile.email ?? "User",
    authorRole: profile.role,
    body: row.body,
    visibility: row.visibility as CollaborationCommentView["visibility"],
    isInternalNote: row.is_internal_note,
    mentions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function collaborationDefaultsForRole(role: Profile["role"]) {
  return {
    defaultVisibility: defaultVisibilityForRole(role),
    allowedVisibilities: allowedVisibilitiesForRole(role),
    canInternalNote: isStaffRole(role),
  };
}
