import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { CloudSenderError, addLeads, cloudSenderConfig, isUuid, listLeads } from "@/lib/linkedin/cloud-sender";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ urls: z.array(z.string().trim().min(1).max(300)).min(1).max(500) });

async function guard(ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return { error: auth.error };
  const { id } = await ctx.params;
  if (!isUuid(id)) return { error: NextResponse.json({ error: "Invalid campaign id." }, { status: 400 }) };
  const cfg = cloudSenderConfig();
  if (!cfg) return { error: NextResponse.json({ error: "The cloud sender is not set up." }, { status: 503 }) };
  return { id, cfg };
}

const fail = (e: unknown, fallback: string) =>
  NextResponse.json({ error: e instanceof CloudSenderError ? e.message : fallback }, { status: e instanceof CloudSenderError ? e.status : 500 });

/** GET: the leads in a sender campaign with their state. Staff only. */
export async function GET(_request: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  try {
    return NextResponse.json({ leads: await listLeads(g.cfg, g.id) });
  } catch (e) {
    return fail(e, "Could not load the leads.");
  }
}

/** POST: add LinkedIn profile links to a sender campaign. Staff only. */
export async function POST(request: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste at least one LinkedIn profile link (up to 500)." }, { status: 400 });
  try {
    return NextResponse.json(await addLeads(g.cfg, g.id, parsed.data.urls.map((url) => ({ url }))));
  } catch (e) {
    return fail(e, "Could not add the leads.");
  }
}
