import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { adminDebug } from "@/lib/debug/admin-debug";
import { apiErrorMessage } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/data/audit";
import { createNotification } from "@/lib/notifications/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

const stageReviewSchema = z.object({
  action: z.enum(["approve", "reject", "set"]),
  feedback: z.string().optional(),
  stage: z.enum(["initialize", "qualify", "deploy", "optimize"]).optional(),
  reason: z.string().max(500).optional(),
});

const STAGE_LABEL: Record<string, string> = {
  initialize: "Initialize",
  qualify: "Qualify",
  deploy: "Deploy",
  optimize: "Optimize",
};

type ProfileRow = {
  id: string;
  journey_stage: string;
  stage_approval_status: string | null;
};

// Raw untyped client to work around missing journey columns in generated DB types
function rawClient(supabase: SupabaseClient): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ profileId: string }> }>,
) {
  const { profileId } = await params;
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { data } = await rawClient(auth.supabase)
    .from("profiles")
    .select("id, journey_stage, stage_approval_status")
    .eq("id", profileId)
    .maybeSingle();
  const row = data as ProfileRow | null;
  return NextResponse.json({
    journey_stage: row?.journey_stage ?? "initialize",
    stage_approval_status: row?.stage_approval_status ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ profileId: string }> }>,
) {
  const { profileId } = await params;

  adminDebug({
    scope: "api.admin.stage-review",
    action: "request_received",
    meta: { profileId },
    path: `/api/admin/stage-review/${profileId}`,
  });

  const auth = await requireStaffApi(["admin"]);

  if ("error" in auth) {
    adminDebug({
      scope: "api.admin.stage-review",
      meta: { profileId },
      error: { message: "Staff auth failed." },
    });
    return auth.error as NextResponse;
  }

  const body = await request.json().catch((exception) => {
    adminDebug({ scope: "api.admin.stage-review", meta: { profileId }, exception });
    return null;
  });

  const parsed = stageReviewSchema.safeParse(body);

  adminDebug({
    scope: "api.admin.stage-review",
    action: "parsed_body",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    meta: { profileId },
    payload: body,
    response: parsed.success ? parsed.data : parsed.error?.flatten(),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid request." },
      { status: 400 },
    );
  }

  const { action, feedback } = parsed.data;

  const { stage, reason } = parsed.data;

  if (action === "reject" && !feedback?.trim()) {
    return NextResponse.json(
      { error: "Feedback is required when rejecting." },
      { status: 400 },
    );
  }

  if (action === "set" && !stage) {
    return NextResponse.json({ error: "A target stage is required." }, { status: 400 });
  }

  const rc = rawClient(auth.supabase);

  let updateError: unknown = null;

  if (action === "approve") {
    const result = await rc
      .from("profiles")
      .update({
        journey_stage: "deploy",
        stage_approval_status: "approved",
        stage_approved_by: auth.profile.id,
        stage_approved_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    updateError = result.error;
  } else if (action === "set") {
    // Admin override: set the journey stage directly (advance or roll back).
    const advanced = stage === "deploy" || stage === "optimize";
    const result = await rc
      .from("profiles")
      .update({
        journey_stage: stage,
        stage_approval_status: advanced ? "approved" : null,
        stage_approved_by: auth.profile.id,
        stage_approved_at: new Date().toISOString(),
        stage_feedback: null,
      })
      .eq("id", profileId);
    updateError = result.error;
  } else {
    const result = await rc
      .from("profiles")
      .update({
        stage_approval_status: "rejected",
        stage_feedback: feedback?.trim() ?? null,
      })
      .eq("id", profileId);
    updateError = result.error;
  }

  if (updateError) {
    const message = apiErrorMessage(updateError);
    adminDebug({
      scope: "api.admin.stage-review",
      action,
      userId: auth.profile.id,
      meta: { profileId },
      error: updateError,
      response: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const auditAction =
    action === "approve" ? "founder_stage_approved" : action === "set" ? "founder_stage_overridden" : "founder_stage_rejected";

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: auditAction,
    entityType: "profile",
    entityId: profileId,
    metadata: { action, stage: stage ?? null, reason: reason?.trim() ?? null, feedback: feedback?.trim() ?? null },
  });

  const notif =
    action === "approve"
      ? { title: "You're approved to Deploy", message: "Your Qualify submission was approved. Your raise workspace is now unlocked." }
      : action === "set"
        ? { title: "Your journey stage was updated", message: `An admin set your journey stage to ${STAGE_LABEL[stage ?? ""] ?? stage}.` }
        : { title: "Changes requested on your submission", message: `An admin requested changes: ${feedback?.trim() ?? ""}`.trim() };

  await createNotification({
    recipientUserId: profileId,
    actorUserId: auth.profile.id,
    type: "founder_stage_review",
    title: notif.title,
    message: notif.message,
    entityType: "profile",
    entityId: profileId,
    deepLink: "/founder/journey",
  });

  const { data: updatedRaw, error: fetchError } = await rc
    .from("profiles")
    .select("id, journey_stage, stage_approval_status")
    .eq("id", profileId)
    .maybeSingle();

  if (fetchError) {
    const message = apiErrorMessage(fetchError);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const profile = updatedRaw as ProfileRow | null;

  adminDebug({
    scope: "api.admin.stage-review",
    action,
    userId: auth.profile.id,
    meta: { profileId },
    status: 200,
  });

  return NextResponse.json({
    success: true,
    profile: profile
      ? {
          id: profile.id,
          journey_stage: profile.journey_stage,
          stage_approval_status: profile.stage_approval_status,
        }
      : {
          id: profileId,
          journey_stage: action === "approve" ? "deploy" : "qualify",
          stage_approval_status: action === "approve" ? "approved" : "rejected",
        },
  });
}
