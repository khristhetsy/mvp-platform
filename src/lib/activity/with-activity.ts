/**
 * One line per route, instead of a bespoke emit call in every handler.
 *
 * 115 founder and investor routes cannot each carry a hand-written
 * `createOperationalEvent` block — they drift, and the ones that matter are the
 * ones somebody forgets. This wraps the handler instead: snapshot before, run
 * the real handler, snapshot after, diff, emit. The handler itself is untouched.
 *
 * Emission is fire-and-forget and wrapped in its own try/catch. An activity
 * event must never fail a founder's save.
 */
import "server-only";
import type { NextRequest } from "next/server";
import { emitActivity } from "@/lib/activity/emit";
import { diffSnapshots, summarizeDiff, type ActivityDiff } from "@/lib/activity/diff";
import type { ActivityClassKey, ActivityStage } from "@/lib/activity/stages";

/** What the wrapper needs to know that it cannot read off the request. */
export type ActivityContext = {
  actorUserId: string | null;
  actorRole?: string | null;
  companyId?: string | null;
  investorId?: string | null;
  spvId?: string | null;
  entityId?: string | null;
  /** Reads the row being changed. Called before and after the handler. */
  snapshot?: () => Promise<Record<string, unknown> | null>;
  /** Which keys the route actually writes. Limits the diff to real edits. */
  fields?: readonly string[];
  /** Extra detail for the event, merged into metadata. */
  metadata?: Record<string, unknown>;
};

export type ActivitySpec = {
  classKey: ActivityClassKey;
  entityType: string;
  sourceModule: string;
  /** Builds the context from the request. Runs before the handler. */
  context: (req: NextRequest, params: unknown) => Promise<ActivityContext | null>;
  /**
   * Title for the event. Gets the diff so it can say what changed.
   * Keep it a sentence a person can act on: "Tinski Tech lowered the capital
   * ask $750,000 → $400,000", not "company updated".
   */
  title: (ctx: ActivityContext, diff: ActivityDiff) => string;
  /**
   * Escalate or downgrade based on what the diff turned out to be. This is
   * where the cross-stage judgement calls live: outreach below the gate, an
   * offering change after an SPV opened. Return null to keep the class default.
   */
  severity?: (ctx: ActivityContext, diff: ActivityDiff) => RouteSeverity | null;
  /**
   * Swap the class entirely based on the outcome — a delete route and an edit
   * route can share a handler, and "changed after an SPV opened" is a different
   * class from "changed".
   */
  classFor?: (ctx: ActivityContext, diff: ActivityDiff) => ActivityClassKey | null;
  /** Skip emission when nothing meaningful happened. Default: skip on no diff. */
  shouldEmit?: (ctx: ActivityContext, diff: ActivityDiff) => boolean;
  stage?: ActivityStage;
};

type RouteSeverity = "info" | "low" | "medium" | "high" | "critical";

type Handler = (req: NextRequest, params: never) => Promise<Response>;

/**
 * Only emit for writes that succeeded. A 400 that changed nothing is not
 * account activity, and emitting on it would make the feed a log of attempts.
 */
function succeeded(res: Response): boolean {
  return res.status >= 200 && res.status < 300;
}

export function withActivity(handler: Handler, spec: ActivitySpec): Handler {
  return async function wrapped(req: NextRequest, params: never): Promise<Response> {
    let ctx: ActivityContext | null = null;
    let before: Record<string, unknown> | null = null;

    try {
      ctx = await spec.context(req, params);
      if (ctx?.snapshot) before = await ctx.snapshot();
    } catch {
      // A failed snapshot costs the diff, not the request.
      ctx = ctx ?? null;
    }

    const res = await handler(req, params);
    if (!ctx || !succeeded(res)) return res;

    try {
      const after = ctx.snapshot ? await ctx.snapshot() : null;
      const diff = diffSnapshots(before, after, ctx.fields);

      const shouldEmit = spec.shouldEmit
        ? spec.shouldEmit(ctx, diff)
        : // No snapshot means the route's meaning is the call itself (a delete,
          // a send, a publish) — emit. With a snapshot, emit only on a real change.
          !ctx.snapshot || diff.changed;
      if (!shouldEmit) return res;

      const classKey = spec.classFor?.(ctx, diff) ?? spec.classKey;
      const severity = spec.severity?.(ctx, diff) ?? undefined;

      emitActivity({
        classKey,
        actorUserId: ctx.actorUserId,
        actorRole: ctx.actorRole ?? null,
        companyId: ctx.companyId ?? null,
        investorId: ctx.investorId ?? null,
        spvId: ctx.spvId ?? null,
        entityType: spec.entityType,
        entityId: ctx.entityId ?? null,
        title: spec.title(ctx, diff),
        description: diff.changed ? summarizeDiff(diff, 3) : null,
        sourceModule: spec.sourceModule,
        diff,
        metadata: ctx.metadata,
        severity: severity ?? undefined,
        stage: spec.stage,
      });
    } catch (error) {
      console.error("[capitalos] withActivity failed", {
        classKey: spec.classKey,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    return res;
  };
}
