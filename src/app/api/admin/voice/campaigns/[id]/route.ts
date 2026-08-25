import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateCampaign, createVariant } from "@/lib/voice/campaigns";
import { buildAudienceConfig } from "@/lib/voice/audience";
import { enrollCampaignCadence } from "@/lib/voice/cadence";
import { audienceConfigSchema } from "@/app/api/admin/voice/campaigns/route";
import type { AudienceConfig, CadenceStep } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

const cadenceStepSchema = z.object({
  channel: z.enum(["voice", "sms", "whatsapp", "email"]),
  delayHours: z.number().int().min(0).max(8760),
  body: z.string().max(1600).nullish(),
});
const patchSchema = z.object({
  action: z.literal("update"),
  name: z.string().min(1).max(160).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  audienceConfig: audienceConfigSchema,
  cadenceSteps: z.array(cadenceStepSchema).max(20).nullish(),
});
const variantSchema = z.object({
  action: z.literal("addVariant"),
  label: z.string().min(1).max(40),
  openerScript: z.string().max(4000).nullish(),
  trafficWeight: z.number().int().min(0).max(100).optional(),
});
const enrollSchema = z.object({ action: z.literal("enrollCadence") });
const bodySchema = z.discriminatedUnion("action", [patchSchema, variantSchema, enrollSchema]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage campaigns." }, { status: 403 });
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.action === "update") {
      const audienceConfig = parsed.data.audienceConfig !== undefined
        ? await buildAudienceConfig((parsed.data.audienceConfig as AudienceConfig | null) ?? null)
        : undefined;
      await updateCampaign(id, { name: parsed.data.name, status: parsed.data.status, audienceConfig, cadenceSteps: parsed.data.cadenceSteps as CadenceStep[] | null | undefined });
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "enrollCadence") {
      const result = await enrollCampaignCadence(id);
      return NextResponse.json(result);
    }
    const variant = await createVariant(id, {
      label: parsed.data.label,
      openerScript: parsed.data.openerScript ?? null,
      trafficWeight: parsed.data.trafficWeight,
    });
    return NextResponse.json({ variant });
  } catch (err) {
    // Lexicon violations surface as a 400 so the operator sees the offending term.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}
