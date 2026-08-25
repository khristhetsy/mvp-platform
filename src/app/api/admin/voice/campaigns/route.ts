import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { listCampaigns, createCampaign } from "@/lib/voice/campaigns";
import { buildAudienceConfig } from "@/lib/voice/audience";
import type { AudienceConfig } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

export const audienceConfigSchema = z
  .object({
    source: z.enum(["all", "list", "segment", "contacts"]),
    listId: z.string().uuid().nullish(),
    listName: z.string().max(160).nullish(),
    segmentKind: z.enum(["module", "status"]).nullish(),
    segmentValue: z.string().max(120).nullish(),
    contactIds: z.array(z.string()).max(20000).nullish(),
  })
  .nullish();

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

const createSchema = z.object({ name: z.string().min(1).max(160), audience: z.enum(["founder", "investor"]), audienceConfig: audienceConfigSchema });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage campaigns." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const audienceConfig = await buildAudienceConfig((parsed.data.audienceConfig as AudienceConfig | null) ?? null);
    return NextResponse.json({ campaign: await createCampaign({ name: parsed.data.name, audience: parsed.data.audience, audienceConfig }) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
