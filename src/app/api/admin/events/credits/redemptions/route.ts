import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { fulfillRedemption, reverseRedemption } from "@/lib/icfo-events/credits";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

/** Fulfil or reverse a Points redemption (staff). */
export async function PATCH(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; action?: "fulfill" | "reverse" };
    if (!body.id || (body.action !== "fulfill" && body.action !== "reverse")) {
      return NextResponse.json({ error: "Missing id or action." }, { status: 400 });
    }

    if (body.action === "fulfill") {
      const redemption = await fulfillRedemption(auth.supabase, body.id);
      if (!redemption) return NextResponse.json({ error: "Couldn't fulfil (already reversed?)." }, { status: 400 });
      await createNotification({
        recipientUserId: redemption.profileId,
        type: "points_redemption",
        title: "Reward applied",
        message: `Your redemption of “${redemption.title}” has been applied to your account.`,
        entityType: "credit_redemption",
        entityId: redemption.id,
        deepLink: "/credits",
      });
      return NextResponse.json({ redemption });
    }

    const result = await reverseRedemption(auth.supabase, body.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    await createNotification({
      recipientUserId: result.redemption.profileId,
      type: "points_redemption",
      title: "Redemption reversed",
      message: `Your redemption of “${result.redemption.title}” was reversed and ${result.redemption.cost} Points were refunded.`,
      entityType: "credit_redemption",
      entityId: result.redemption.id,
      deepLink: "/credits",
    });
    return NextResponse.json({ redemption: result.redemption });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't update the redemption." }, { status: 500 });
  }
}
