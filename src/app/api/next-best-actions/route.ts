import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import type { NextBestActionRole } from "@/lib/next-best-actions/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function parseRole(value: string | null): NextBestActionRole | undefined {
  if (value === "founder" || value === "investor" || value === "admin" || value === "analyst") {
    return value;
  }
  return undefined;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const role = parseRole(url.searchParams.get("role"));
  const contextPath = url.searchParams.get("contextPath") ?? undefined;
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 5;
  const sync = url.searchParams.get("sync") !== "false";
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const result = await loadAndMergeNextBestActions({
    profile: auth.profile,
    supabase: auth.supabase,
    options: {
      role,
      contextPath,
      entityType,
      entityId,
      limit,
      sync,
      includeInactive,
    },
  });

  emitOperationalEvent(createServiceRoleClient(), {
    eventType: "next_best_actions_viewed",
    eventCategory: "analytics",
    entityType: "user",
    entityId: auth.profile.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    severity: "info",
    title: "Next best actions viewed",
    description: null,
    metadata: {
      action_count: result.actions.length,
      role: result.role,
      has_entity_filter: Boolean(entityType && entityId),
      lifecycle: true,
    },
    sourceModule: "next_best_actions",
    visibility: "admin_only",
    dedupeKey: `nba_viewed:${auth.profile.id}:${result.role}:${entityType ?? "all"}:${entityId ?? "all"}`,
    dedupeWindowMinutes: 5,
  });

  return NextResponse.json(result);
}
