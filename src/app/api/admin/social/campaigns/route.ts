/**
 * Social campaigns — list (with ROI report) and create. Staff-only.
 *   GET  → { campaigns: CampaignReport[] }
 *   POST { name, budgetCents } → { campaign }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { campaignReports, createCampaign, updateCampaign, setCampaignArchived, deleteCampaign } from "@/lib/social/campaigns";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ campaigns: await campaignReports() });
}

const schema = z.object({ name: z.string().min(1).max(120), budgetCents: z.number().int().min(0).max(1_000_000_00).default(0) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const campaign = await createCampaign(parsed.data.name, parsed.data.budgetCents, profile.id);
  if (!campaign) return NextResponse.json({ error: "Could not create campaign." }, { status: 400 });
  return NextResponse.json({ campaign });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let ok = true;
  if (parsed.data.name !== undefined) ok = await updateCampaign(parsed.data.id, { name: parsed.data.name });
  if (ok && parsed.data.archived !== undefined) ok = await setCampaignArchived(parsed.data.id, parsed.data.archived);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const ok = await deleteCampaign(parsed.data.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
