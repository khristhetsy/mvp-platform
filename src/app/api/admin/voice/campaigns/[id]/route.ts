import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateCampaign, createVariant } from "@/lib/voice/campaigns";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.literal("update"),
  name: z.string().min(1).max(160).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
});
const variantSchema = z.object({
  action: z.literal("addVariant"),
  label: z.string().min(1).max(40),
  openerScript: z.string().max(4000).nullish(),
  trafficWeight: z.number().int().min(0).max(100).optional(),
});
const bodySchema = z.discriminatedUnion("action", [patchSchema, variantSchema]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage campaigns." }, { status: 403 });
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.action === "update") {
      await updateCampaign(id, { name: parsed.data.name, status: parsed.data.status });
      return NextResponse.json({ ok: true });
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
