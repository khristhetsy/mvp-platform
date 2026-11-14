import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import {
  loadEventNotificationSettings,
  saveEventNotificationSettings,
} from "@/lib/icfo-events/notification-settings";
import { NUDGE_START_DAYS } from "@/lib/icfo-events/event-notification-rules";

export const dynamic = "force-dynamic";

/** Current founder event nudge setting (staff). */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const s = await loadEventNotificationSettings();
    return NextResponse.json({ enabled: s.nudgeHome || s.nudgeBanner, startDays: s.nudgeStartDays });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load the setting." }, { status: 500 });
  }
}

/** Save the switch and the days before (staff). The switch controls Home and the Raise banner together. */
export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { enabled?: unknown; startDays?: unknown };
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });
    }
    if (!(NUDGE_START_DAYS as readonly unknown[]).includes(body.startDays)) {
      return NextResponse.json({ error: "startDays must be 3, 7, 10, 14 or 21." }, { status: 400 });
    }
    const current = await loadEventNotificationSettings();
    const result = await saveEventNotificationSettings(
      { ...current, nudgeHome: body.enabled, nudgeBanner: body.enabled, nudgeStartDays: body.startDays },
      auth.profile.id,
    );
    if (!result.ok) return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });
    return NextResponse.json({ enabled: body.enabled, startDays: result.settings.nudgeStartDays });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save the setting." }, { status: 500 });
  }
}
