import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listMissions, createMission } from "@/lib/icfo-events/missions";

export const dynamic = "force-dynamic";

const ACTIONS = ["register", "session_viewed", "applied", "approved", "networking_optin", "connection_accepted"] as const;

const schema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  requiredActions: z.array(z.enum(ACTIONS)).min(1).max(6),
  bonusPoints: z.number().int().min(0).max(1000).default(0),
});

export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ missions: await listMissions(auth.supabase) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load missions." }, { status: 500 });
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
    const mission = await createMission(auth.supabase, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      requiredActions: parsed.data.requiredActions,
      bonusPoints: parsed.data.bonusPoints,
    });
    return NextResponse.json({ mission }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create mission." }, { status: 500 });
  }
}
