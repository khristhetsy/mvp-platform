import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createAuditDraft, editDraft, SalesAiError } from "@/lib/sales-ai/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function staff() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile: auth.profile };
}

const postSchema = z.object({ includeRefundOffer: z.boolean().default(true) });

// POST: read the conversation, write the audit and an email draft. Saves a draft only. Sends nothing.
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const { id } = await params;
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const draft = await createAuditDraft(id, a.profile.id, parsed.data.includeRefundOffer);
    return NextResponse.json({ draft });
  } catch (err) {
    const status = err instanceof SalesAiError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not prepare the draft." }, { status });
  }
}

const patchSchema = z.object({
  draftId: z.string().uuid(),
  subject: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(100_000).optional(),
  includeRefundOffer: z.boolean().optional(),
  // "sent" is recorded by the panel only after the existing send route succeeded.
  status: z.enum(["sent", "discarded"]).optional(),
});

// PATCH: edit the draft, switch the refund line, discard it, or record that it was sent.
export async function PATCH(req: Request): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { draftId, ...edit } = parsed.data;
  try {
    const draft = await editDraft(draftId, edit, a.profile.id);
    return NextResponse.json({ draft });
  } catch (err) {
    const status = err instanceof SalesAiError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update the draft." }, { status });
  }
}
