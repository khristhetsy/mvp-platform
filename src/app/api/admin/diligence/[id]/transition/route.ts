import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { markReviewReady, recall, ActionError } from "@/lib/diligence/admin-actions";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["mark_review", "recall"]) });

/** POST — admin stage actions that don't need their own endpoint. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  try {
    if (parsed.data.action === "mark_review") await markReviewReady(auth.supabase, id, auth.userId);
    else await recall(auth.supabase, id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed." }, { status: 500 });
  }
}
