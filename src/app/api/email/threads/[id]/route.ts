import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { getThread, replyToThread, markThreadRead, deleteThread } from "@/lib/email/inbox";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await getThread(auth.supabase, auth.profile.id, id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Opening a thread clears its unread flag.
  if (result.thread.unread) await markThreadRead(auth.supabase, auth.profile.id, id);
  return NextResponse.json(result);
}

const replySchema = z.object({ body: z.string().min(1).max(50000) });

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = replySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const messages = await replyToThread(
      auth.supabase,
      { id: auth.profile.id, email: auth.profile.email, name: auth.profile.full_name },
      id,
      parsed.data.body,
    );
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reply failed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await deleteThread(auth.profile.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
