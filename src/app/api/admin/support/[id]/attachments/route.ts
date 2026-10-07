import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { uploadSupportPdf } from "@/lib/support/attachments";

export const dynamic = "force-dynamic";

/** Staff attach a PDF to a reply or note. Returns the attachment to send with the message. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });
  const r = await uploadSupportPdf(id, file);
  return "error" in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json({ attachment: r });
}
