/**
 * Social campaigns — list (with ROI report) and create. Staff-only.
 *   GET  → { campaigns: CampaignReport[] }
 *   POST { name, budgetCents } → { campaign }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { campaignReports, createCampaign } from "@/lib/social/campaigns";

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
