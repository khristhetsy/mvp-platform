import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { getThread, replyToThread, markThreadRead, deleteThread, setThreadUnread, trashThread, restoreThread, setThreadSpam } from "@/lib/email/inbox";

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

const replySchema = z.object({
  body: z.string().min(1).max(50000),
  html: z.string().max(60000).optional(),
  attachments: z
    .array(z.object({ name: z.string().max(200), path: z.string().max(400), size: z.number().int().nonnegative(), content_type: z.string().nullish() }))
    .max(10)
    .optional(),
});

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
      parsed.data.attachments?.map((a) => ({ ...a, content_type: a.content_type ?? null })),
      parsed.data.html ?? null,
    );
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reply failed." }, { status: 500 });
  }
}

const patchSchema = z.object({ unread: z.boolean().optional(), trashed: z.boolean().optional(), spam: z.boolean().optional() });

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (parsed.data.unread !== undefined) {
    await setThreadUnread(auth.supabase, auth.profile.id, id, parsed.data.unread);
  }
  if (parsed.data.trashed === true) await trashThread(auth.supabase, auth.profile.id, id);
  if (parsed.data.trashed === false) await restoreThread(auth.supabase, auth.profile.id, id);
  if (parsed.data.spam === true) await setThreadSpam(auth.supabase, auth.profile.id, id, true);
  if (parsed.data.spam === false) await setThreadSpam(auth.supabase, auth.profile.id, id, false);
  return NextResponse.json({ success: true });
}

// DELETE moves to Trash (soft) by default; ?purge=true permanently deletes.
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const purge = req.nextUrl.searchParams.get("purge") === "true";
  try {
    if (purge) await deleteThread(auth.profile.id, id);
    else await trashThread(auth.supabase, auth.profile.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
