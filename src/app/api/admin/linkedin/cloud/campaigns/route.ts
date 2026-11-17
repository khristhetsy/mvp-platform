import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { CloudSenderError, cloudSenderConfig, createCampaign } from "@/lib/linkedin/cloud-sender";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(120), note: z.string().trim().max(300).optional() });

/** POST: create a campaign on the sender. It always starts as a dry run. Staff only. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const cfg = cloudSenderConfig();
  if (!cfg) return NextResponse.json({ error: "The cloud sender is not set up." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give the campaign a name (and keep any note under 300 characters)." }, { status: 400 });
  try {
    return NextResponse.json({ id: await createCampaign(cfg, parsed.data.name, parsed.data.note, undefined) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof CloudSenderError ? e.message : "Could not create the campaign." }, { status: e instanceof CloudSenderError ? e.status : 500 });
  }
}
