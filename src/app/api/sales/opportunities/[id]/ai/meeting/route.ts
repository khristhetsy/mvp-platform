import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createFollowUpDraft, getMeetingBrief, SalesAiError } from "@/lib/sales-ai/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function staff() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile: auth.profile };
}

// GET: the brief before a meeting, from the record. Read only.
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const { id } = await params;
  try {
    return NextResponse.json({ brief: await getMeetingBrief(id) });
  } catch (err) {
    const status = err instanceof SalesAiError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not build the brief." }, { status });
  }
}

const postSchema = z.object({
  notes: z.string().max(5000),
  saveNote: z.boolean().default(true),
  includeRefundOffer: z.boolean().default(true),
});

// POST: after a meeting. The person's own notes make a follow up draft and suggested tasks.
// The Notes log entry is written only when saveNote is true, which is the person's click.
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const { id } = await params;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a line or two about the meeting first." }, { status: 400 });
  try {
    const result = await createFollowUpDraft(id, a.profile.id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof SalesAiError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not prepare the follow up." }, { status });
  }
}
