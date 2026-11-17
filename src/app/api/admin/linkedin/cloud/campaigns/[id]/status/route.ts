import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { CloudSenderError, cloudSenderConfig, isUuid, setStatus } from "@/lib/linkedin/cloud-sender";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ status: z.enum(["dry_run", "running", "paused"]), confirm: z.boolean().optional() });

/** POST: pause, return to dry run, or go live. Going live needs confirm: true. Staff only. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  const cfg = cloudSenderConfig();
  if (!cfg) return NextResponse.json({ error: "The cloud sender is not set up." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  if (parsed.data.status === "running" && parsed.data.confirm !== true) {
    return NextResponse.json({ error: "Confirm before going live. This sends real invites." }, { status: 400 });
  }
  try {
    return NextResponse.json(await setStatus(cfg, id, parsed.data.status));
  } catch (e) {
    return NextResponse.json({ error: e instanceof CloudSenderError ? e.message : "Could not change the campaign." }, { status: e instanceof CloudSenderError ? e.status : 500 });
  }
}
