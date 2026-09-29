import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { loadBudgetConfig } from "@/lib/notifications/founder-email-budget/config";
import { loadFounderPrefs, saveFounderPrefs } from "@/lib/notifications/founder-email-budget/prefs";
import { cohortFor } from "@/lib/notifications/founder-email-budget/rules";

export const dynamic = "force-dynamic";

/** GET: the signed-in founder's email choices, and whether the budget applies to them yet. */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const [cfg, prefs] = await Promise.all([loadBudgetConfig(), loadFounderPrefs(auth.profile.id)]);
  return NextResponse.json({
    prefs,
    active: cohortFor(auth.profile.id, cfg) === "rollout",
    defaultSendHour: cfg.sendHour,
  });
}

/** PUT: save mode (daily, weekly, instant), send hour, time zone and skip-if-active. */
export async function PUT(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Send your email choices." }, { status: 400 });
  const saved = await saveFounderPrefs(auth.profile.id, {
    mode: body.mode,
    sendHour: body.sendHour,
    timezone: body.timezone,
    skipIfActive: body.skipIfActive,
  });
  if (!saved) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true, prefs: saved });
}
