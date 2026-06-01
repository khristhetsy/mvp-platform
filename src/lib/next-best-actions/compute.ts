import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeFounderActions,
  loadFounderNbaContext,
} from "@/lib/next-best-actions/compute-founder-actions";
import {
  computeInvestorActions,
  loadInvestorNbaContext,
} from "@/lib/next-best-actions/compute-investor-actions";
import {
  computeAdminActions,
  loadAdminNbaContext,
} from "@/lib/next-best-actions/compute-admin-actions";
import { loadDocumentExecutionNbaActions } from "@/lib/document-execution/nba-actions";
import { limitNextBestActions } from "@/lib/next-best-actions/priority";
import {
  NBA_DISCLAIMER,
  type ComputeNextBestActionsOptions,
  type NextBestAction,
  type NextBestActionRole,
  type NextBestActionsResult,
} from "@/lib/next-best-actions/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Profile, Database, UserRole } from "@/lib/supabase/types";

export { NBA_DISCLAIMER };

function roleFromProfile(profile: Profile, requested?: NextBestActionRole): NextBestActionRole {
  if (requested) return requested;
  if (profile.role === "investor") return "investor";
  if (profile.role === "admin") return "admin";
  if (profile.role === "analyst") return "analyst";
  return "founder";
}

function assertRoleAccess(profileRole: UserRole, targetRole: NextBestActionRole): boolean {
  if (targetRole === "founder") return profileRole === "founder";
  if (targetRole === "investor") return profileRole === "investor";
  if (targetRole === "admin" || targetRole === "analyst") {
    return profileRole === "admin" || profileRole === "analyst";
  }
  return false;
}

export async function loadAndComputeNextBestActions(input: {
  profile: Profile;
  supabase: SupabaseClient<Database>;
  options?: ComputeNextBestActionsOptions;
}): Promise<NextBestActionsResult> {
  const limit = Math.min(Math.max(input.options?.limit ?? 5, 1), 20);
  const role = roleFromProfile(input.profile, input.options?.role);

  if (!assertRoleAccess(input.profile.role, role)) {
    return { actions: [], role, disclaimer: NBA_DISCLAIMER };
  }

  const entityFilter =
    input.options?.entityType && input.options?.entityId
      ? { entityType: input.options.entityType, entityId: input.options.entityId }
      : undefined;

  let actions: NextBestAction[] = [];

  if (role === "founder") {
    const ctx = await loadFounderNbaContext(input.profile, input.supabase);
    actions = computeFounderActions(ctx, entityFilter);
  } else if (role === "investor") {
    const ctx = await loadInvestorNbaContext(input.profile, input.supabase);
    actions = computeInvestorActions(ctx, {
      ...entityFilter,
      entityType: entityFilter?.entityType ?? "investor",
      entityId: entityFilter?.entityId ?? input.profile.id,
    });
  } else {
    const adminClient = createServiceRoleClient();
    const ctx = await loadAdminNbaContext(adminClient);
    const [adminActions, executionActions] = await Promise.all([
      Promise.resolve(computeAdminActions(ctx, role, entityFilter)),
      loadDocumentExecutionNbaActions(role, entityFilter, 4),
    ]);
    actions = [...adminActions, ...executionActions];
  }

  return {
    actions: limitNextBestActions(actions, limit),
    role,
    disclaimer: NBA_DISCLAIMER,
  };
}

export function isNextBestActionIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("what should i do next") ||
    lower.includes("what needs attention") ||
    lower.includes("what is blocking") ||
    lower.includes("what's blocking") ||
    lower.includes("what do i do next") ||
    lower.includes("next step") ||
    lower.includes("priority") && lower.includes("now")
  );
}
