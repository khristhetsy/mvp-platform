import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { adminDebug } from "@/lib/debug/admin-debug";
import { apiErrorMessage } from "@/lib/api/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

const stageReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  feedback: z.string().optional(),
});

type ProfileRow = {
  id: string;
  journey_stage: string;
  stage_approval_status: string | null;
};

// Raw untyped client to work around missing journey columns in generated DB types
function rawClient(supabase: SupabaseClient): SupabaseClient {
  return supabase as unknown as SupabaseClient;
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

  if (action === "reject" && !feedback?.trim()) {
    return NextResponse.json(
      { error: "Feedback is required when rejecting." },
      { status: 400 },
    );
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
