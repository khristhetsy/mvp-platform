/**
 * The one way an account-activity event gets recorded.
 *
 * Every founder and investor write path calls `recordActivity` (or the
 * `withActivity` wrapper in `with-activity.ts`, which calls this). It:
 *
 *   1. resolves the actor's stage AT THE TIME — never looked up later, because
 *      a company that has since advanced must not retro-date its old events
 *      into its new stage;
 *   2. writes the row through the existing operational-activity layer, so
 *      sanitising, dedupe and severity normalisation stay in one place;
 *   3. hands the event to the notification dispatcher.
 *
 * Fire-and-forget by default. An activity event must never fail a founder's
 * save — the record is valuable, the write it describes is the product.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createOperationalEvent } from "@/lib/operational-activity/create-event";
import type { OperationalEventCategory } from "@/lib/operational-activity/types";
import {
  type ActivityAudience,
  type ActivityClassKey,
  type ActivityStage,
  activityClass,
  activityEventType,
  audienceOfStage,
  isActivityStage,
} from "@/lib/activity/stages";
import type { ActivityDiff } from "@/lib/activity/diff";
import { dispatchActivityNotifications } from "@/lib/activity/dispatch";

export type RecordActivityInput = {
  classKey: ActivityClassKey;
  actorUserId: string | null;
  actorRole?: string | null;
  companyId?: string | null;
  investorId?: string | null;
  spvId?: string | null;
  entityType: string;
  entityId?: string | null;
  title: string;
  description?: string | null;
  sourceModule: string;
  diff?: ActivityDiff | null;
  metadata?: Record<string, unknown>;
  /**
   * Overrides the class's own severity. Used by the two cross-stage judgement
   * calls — outreach below the gate, an offering change after an SPV opened —
   * where the same field change means something different in context.
   */
  severity?: "info" | "low" | "medium" | "high" | "critical";
  /**
   * Stage the action happened in. Normally omitted: it is read from the
   * company's or investor's current stage. Pass it when the caller already
   * knows, to save a query.
   */
  stage?: ActivityStage;
  dedupeKey?: string | null;
  dedupeWindowMinutes?: number;
};

/** Which of the 0044 categories an activity class belongs to. */
function categoryFor(audience: ActivityAudience, classKey: ActivityClassKey): OperationalEventCategory {
  if (classKey.startsWith("document") || classKey.startsWith("data_room")) return "diligence";
  if (classKey.startsWith("spv") || classKey.startsWith("participation")) return "spv";
  if (classKey.startsWith("outreach") || classKey.startsWith("campaign")) return "outreach";
  if (classKey.startsWith("onboarding")) return "onboarding";
  return audience === "investor" ? "investor" : "founder";
}

/**
 * The founder's journey stage right now.
 *
 * `journey_stage` lives on PROFILES, not on companies — the stage belongs to the
 * founder, and a company row is reached through `companies.founder_id`. Getting
 * this wrong would silently stamp every event with the class's default stage.
 */
async function founderStageOf(companyId: string): Promise<ActivityStage | null> {
  try {
    const admin = createServiceRoleClient();
    const { data: company } = await admin
      .from("companies")
      .select("founder_id")
      .eq("id", companyId)
      .maybeSingle();
    const founderId = (company as Record<string, unknown> | null)?.founder_id;
    if (typeof founderId !== "string") return null;

    const { data } = await admin
      .from("profiles")
      .select("journey_stage")
      .eq("id", founderId)
      .maybeSingle();
    const raw = (data as Record<string, unknown> | null)?.journey_stage;
    const stage = typeof raw === "string" ? raw : null;
    return stage && isActivityStage(stage) ? stage : null;
  } catch {
    return null;
  }
}

/** The investor's pipeline stage right now. Null when they are on no pipeline. */
async function investorStageOf(investorId: string): Promise<ActivityStage | null> {
  try {
    const admin = createServiceRoleClient();
    // An investor can sit on several companies' pipelines at once. The most
    // recently active row is the one that describes where they are today.
    const { data } = await admin
      .from("investor_pipeline")
      .select("stage, last_activity_at")
      .eq("investor_id", investorId)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const raw = (data as Record<string, unknown> | null)?.stage;
    const stage = typeof raw === "string" ? raw : null;
    return stage && isActivityStage(stage) ? stage : null;
  } catch {
    return null;
  }
}

/**
 * Record one account-activity event and notify whoever holds its stage.
 *
 * Returns the event id, or null when nothing was written. Never throws.
 */
export async function recordActivity(input: RecordActivityInput): Promise<string | null> {
  try {
    const cls = activityClass(input.classKey);
    if (!cls) return null;

    const audience = audienceOfStage(cls.stage);

    // The class declares which stage it belongs to, but the STAGE STAMPED ON THE
    // EVENT is where the account actually was. They differ when a founder does
    // something out of order — uploading a document after reaching Closing, say
    // — and that mismatch is exactly the signal worth keeping.
    let stage: ActivityStage = input.stage ?? cls.stage;
    if (!input.stage) {
      const actual = input.companyId
        ? await founderStageOf(input.companyId)
        : input.investorId
          ? await investorStageOf(input.investorId)
          : null;
      if (actual && audienceOfStage(actual) === audience) stage = actual;
    }

    const admin = createServiceRoleClient();
    const result = await createOperationalEvent(admin, {
      eventType: activityEventType(input.classKey),
      eventCategory: categoryFor(audience, input.classKey),
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole ?? audience,
      companyId: input.companyId ?? null,
      investorId: input.investorId ?? null,
      spvId: input.spvId ?? null,
      severity: input.severity ?? cls.severity,
      title: input.title,
      description: input.description ?? cls.description,
      sourceModule: input.sourceModule,
      visibility: "admin_only",
      dedupeKey: input.dedupeKey ?? null,
      dedupeWindowMinutes: input.dedupeWindowMinutes,
      metadata: {
        ...(input.metadata ?? {}),
        activity_class: input.classKey,
        ...(input.diff?.changed
          ? { changed_fields: input.diff.fields, changes: input.diff.changes }
          : {}),
      },
    });

    if (!("id" in result)) return null;

    // The stage and audience columns are ours, added after 0044, so they are set
    // here rather than threaded through createOperationalEvent's input type.
    // Untyped because src/lib/supabase/types.ts predates the two columns.
    await (admin as unknown as SupabaseClient)
      .from("operational_activity_events")
      .update({ activity_audience: audience, activity_stage: stage })
      .eq("id", result.id);

    await dispatchActivityNotifications({
      eventId: result.id,
      classKey: input.classKey,
      stage,
      severity: input.severity ?? cls.severity,
      title: input.title,
      companyId: input.companyId ?? null,
      investorId: input.investorId ?? null,
      actorUserId: input.actorUserId,
    });

    return result.id;
  } catch (error) {
    console.error("[capitalos] activity event failed", {
      classKey: input.classKey,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/** Fire-and-forget. Use on request paths — never blocks the response. */
export function emitActivity(input: RecordActivityInput): void {
  void recordActivity(input);
}
