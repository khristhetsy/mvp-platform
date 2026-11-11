import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { approveCampaign, deleteCampaign, getCampaign, setCampaignArchived, setCampaignStatus, startCampaign, updateCampaign } from "@/lib/linkedin/store";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: Promise<{ id: string }> };

const editSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  invite_variants: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().max(400) })).max(5).optional(),
  message_text: z.string().max(2500).nullable().optional(),
  connected_message_text: z.string().max(2500).nullable().optional(),
  handoff_mode: z.enum(["web_chat", "linkedin"]).optional(),
  agent: z.enum(["johnny", "jessica"]).optional(),
});

/** PATCH: edit a campaign. Changing any wording clears the approval. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  const parsed = editSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the wording." }, { status: 400 });
  try {
    return NextResponse.json({ campaign: await updateCampaign(id, parsed.data) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 500 });
  }
}

const actionSchema = z.object({ action: z.enum(["approve", "start", "pause", "resume", "stop", "archive", "restore"]) });

/** POST { action }: approve the wording, start, pause, resume, stop, archive or restore. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  try {
    if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    const userId = auth.profile.id;
    switch (parsed.data.action) {
      case "approve": {
        const r = await approveCampaign(id, userId);
        return r.ok ? NextResponse.json({ campaign: r.campaign }) : NextResponse.json({ error: r.problems[0]?.message ?? "Fix the wording.", problems: r.problems }, { status: 400 });
      }
      case "start": {
        const r = await startCampaign(id, userId);
        return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
      }
      case "pause": await setCampaignStatus(id, "paused", userId); break;
      case "resume": await setCampaignStatus(id, "ready", userId); break;
      case "stop": await setCampaignStatus(id, "stopped", userId); break;
      case "archive":
      case "restore": {
        const r = await setCampaignArchived(id, parsed.data.action === "archive");
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        break;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
  }
}

/** DELETE: remove a stopped, draft or finished campaign for good. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });
  try {
    const r = await deleteCampaign(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "Campaign not found." ? 404 : 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
  }
}
