import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupportThread } from "@/lib/support/support";
import { uploadSupportPdf } from "@/lib/support/attachments";

export const dynamic = "force-dynamic";

/** A founder attaches a PDF to their own request. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { id } = await ctx.params;
  const thread = await getSupportThread(await createServerSupabaseClient(), id);
  if (!thread || thread.request.founder_id !== profile.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });
  const r = await uploadSupportPdf(id, file);
  return "error" in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json({ attachment: r });
}
