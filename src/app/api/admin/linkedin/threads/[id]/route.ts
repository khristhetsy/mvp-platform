import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { listMessages, takeOverThread } from "@/lib/linkedin/store";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: Promise<{ id: string }> };

/** GET: the messages in one LinkedIn conversation. */
export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
  return NextResponse.json({ messages: await listMessages(id) });
}

/** POST: take the conversation over from the AI assistant. */
export async function POST(_request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
  try {
    await takeOverThread(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not take over." }, { status: 500 });
  }
}
