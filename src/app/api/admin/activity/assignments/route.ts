/**
 * Stage assignment reads and writes.
 *
 *   GET                              → the whole board
 *   PUT  { stage, userIds, leadUserId, escalateAfterMinutes, escalateToUserId }
 *   POST { action: "column", audience, userId, assigned }   — one person, every stage
 *   POST { action: "bulk", stages, addUserIds, removeUserIds, leadUserId, escalate* }
 *
 * The three write shapes mirror the three select-alls in the UI, because they
 * mean genuinely different things: a column write is "this person sees
 * everything", a bulk write is "these stages get this change", and a single PUT
 * replaces one stage's set outright.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import {
  loadStageAssignments,
  saveStageAssignment,
  setStaffAcrossStages,
} from "@/lib/activity/assignments";
import { audienceOfStage, isActivityStage } from "@/lib/activity/stages";

export const dynamic = "force-dynamic";

/** Assignment decides who is accountable, so it needs the settings permission. */
async function requireManager() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth;
  const supabase = await createServerSupabaseClient();
  const { permissions } = await getEffectivePermissions(supabase, auth.profile.id, auth.profile);
  if (!permissions.includes("manage_settings")) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission to change stage assignment." },
        { status: 403 },
      ),
    };
  }
  return auth;
}

export async function GET() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json(await loadStageAssignments());
}

const putSchema = z.object({
  stage: z.string(),
  userIds: z.array(z.string().uuid()).max(50),
  leadUserId: z.string().uuid().nullable(),
  escalateAfterMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  escalateToUserId: z.string().uuid().nullable().optional(),
});

export async function PUT(request: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isActivityStage(parsed.data.stage)) {
    return NextResponse.json({ error: "Invalid assignment." }, { status: 400 });
  }

  const stage = parsed.data.stage;
  const result = await saveStageAssignment({
    audience: audienceOfStage(stage),
    stage,
    userIds: parsed.data.userIds,
    leadUserId: parsed.data.leadUserId,
    escalateAfterMinutes: parsed.data.escalateAfterMinutes,
    escalateToUserId: parsed.data.escalateToUserId,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(await loadStageAssignments());
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("column"),
    audience: z.enum(["founder", "investor"]),
    userId: z.string().uuid(),
    assigned: z.boolean(),
  }),
  z.object({
    action: z.literal("bulk"),
    stages: z.array(z.string()).min(1).max(20),
    addUserIds: z.array(z.string().uuid()).max(50).optional(),
    removeUserIds: z.array(z.string().uuid()).max(50).optional(),
    leadUserId: z.string().uuid().nullable().optional(),
    escalateAfterMinutes: z.number().int().min(0).max(10080).nullable().optional(),
    escalateToUserId: z.string().uuid().nullable().optional(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.action === "column") {
    const result = await setStaffAcrossStages({
      audience: parsed.data.audience,
      userId: parsed.data.userId,
      assigned: parsed.data.assigned,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    // Un-ticking a column can strip a lead. The caller is told exactly which
    // stages lost theirs, so the confirm can name them rather than leaving the
    // stage quietly lead-less.
    return NextResponse.json({
      ...(await loadStageAssignments()),
      clearedLeads: result.clearedLeads,
    });
  }

  const stages = parsed.data.stages.filter(isActivityStage);
  if (!stages.length) return NextResponse.json({ error: "No valid stages." }, { status: 400 });

  const board = await loadStageAssignments();
  const add = parsed.data.addUserIds ?? [];
  const remove = new Set(parsed.data.removeUserIds ?? []);

  for (const stage of stages) {
    const current = board.stages.find((s) => s.stage === stage);
    const next = [...new Set([...(current?.userIds ?? []), ...add])].filter(
      (id) => !remove.has(id),
    );

    // A lead is only applied to stages the person is actually on, so a bulk
    // "set lead" over a mixed selection cannot create a lead who is not an
    // assignee.
    const lead =
      parsed.data.leadUserId !== undefined
        ? parsed.data.leadUserId && next.includes(parsed.data.leadUserId)
          ? parsed.data.leadUserId
          : null
        : ((current?.leadUserId ?? null) && next.includes(current!.leadUserId!)
            ? current!.leadUserId
            : null);

    const result = await saveStageAssignment({
      audience: audienceOfStage(stage),
      stage,
      userIds: next,
      leadUserId: lead ?? null,
      escalateAfterMinutes: parsed.data.escalateAfterMinutes,
      escalateToUserId: parsed.data.escalateToUserId,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(await loadStageAssignments());
}
