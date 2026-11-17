import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { addCloudAudience, previewCloudAudience } from "@/lib/linkedin/cloud-crm";
import { CloudSenderError, cloudSenderConfig, isUuid } from "@/lib/linkedin/cloud-sender";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignId: z.string().refine(isUuid, "Invalid campaign id."),
  add: z.boolean().optional(),
  filters: z.object({
    module: z.enum(["investor", "founder"]).optional(),
    stage: z.string().trim().max(80).optional(),
    tag: z.string().trim().max(80).optional(),
    industry: z.string().trim().max(80).optional(),
  }),
});

/** POST { campaignId, filters, add? }: count who is ready, or with add: true send them to the sender campaign. Staff only. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const cfg = cloudSenderConfig();
  if (!cfg) return NextResponse.json({ error: "The cloud sender is not set up." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the campaign and filters." }, { status: 400 });
  const { campaignId, filters, add } = parsed.data;
  try {
    if (add) return NextResponse.json(await addCloudAudience(cfg, campaignId, filters));
    return NextResponse.json({ summary: await previewCloudAudience(cfg, campaignId, filters) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof CloudSenderError || e instanceof Error ? e.message : "Could not build the audience." }, { status: e instanceof CloudSenderError ? e.status : 500 });
  }
}
