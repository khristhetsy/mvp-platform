import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { listCampaigns, createCampaign } from "@/lib/voice/campaigns";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ campaigns: await listCampaigns() });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not load campaigns." }, { status: 500 });
  }
}

const createSchema = z.object({ name: z.string().min(1).max(160), audience: z.enum(["founder", "investor"]) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage campaigns." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json({ campaign: await createCampaign(parsed.data) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
