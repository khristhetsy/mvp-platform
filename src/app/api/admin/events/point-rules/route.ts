import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getPointRules, setPointRule } from "@/lib/icfo-events/gamification";
import type { PointAction } from "@/lib/icfo-events/gamification";

export const dynamic = "force-dynamic";

const schema = z.object({
  rules: z.record(
    z.enum(["register", "session_viewed", "applied", "approved", "networking_optin", "connection_accepted"]),
    z.number().int().min(0).max(1000),
  ),
});

export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rules = await getPointRules(auth.supabase);
    return NextResponse.json({ rules });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load point rules." }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const entries = Object.entries(parsed.data.rules) as [PointAction, number][];
    for (const [action, points] of entries) {
      await setPointRule(auth.supabase, action, points);
    }
    const rules = await getPointRules(auth.supabase);
    return NextResponse.json({ rules });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save point rules." }, { status: 500 });
  }
}
