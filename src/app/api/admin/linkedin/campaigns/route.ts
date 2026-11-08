import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { createCampaign, getOrCreateAccount } from "@/lib/linkedin/store";

export const dynamic = "force-dynamic";

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  audience: z.object({
    source: z.enum(["crm"]).default("crm"),
    filters: z.object({
      module: z.enum(["investor", "founder"]).optional(),
      stage: z.string().trim().max(80).optional(),
      tag: z.string().trim().max(80).optional(),
      industry: z.string().trim().max(80).optional(),
    }).default({}),
  }),
  invite_variants: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().max(400) })).max(5).default([]),
  message_text: z.string().max(2500).nullable().default(null),
  handoff_mode: z.enum(["web_chat", "linkedin"]).default("web_chat"),
  agent: z.enum(["johnny", "jessica"]).default("johnny"),
});

/** POST: save a new campaign as a draft. Nothing is queued until the wording is approved and the campaign is started. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const parsed = campaignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the campaign name and wording." }, { status: 400 });
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    return NextResponse.json({ campaign: await createCampaign(account.id, auth.profile.id, parsed.data) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 500 });
  }
}
