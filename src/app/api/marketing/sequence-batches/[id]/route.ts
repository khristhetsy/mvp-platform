import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sequenceSender } from "@/lib/marketing/approve-permission";
import { getBatchPreview, markBatchReviewed, setBatchHold, setBatchSendAfter } from "@/lib/marketing/sequence-schedule-store";

export const dynamic = "force-dynamic";

// GET /api/marketing/sequence-batches/[id]: preview (email and recipients) for the review drawer.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await sequenceSender();
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json(await getBatchPreview(id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review") }),
  z.object({ action: z.literal("hold") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("reschedule"), send_after: z.string().datetime().nullable() }),
]);

// PATCH /api/marketing/sequence-batches/[id]: review, hold, resume or reschedule a pending batch.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await sequenceSender();
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.action !== "review" && !who.canApprove) {
    return NextResponse.json({ error: "You don't have permission to change when this sends." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const b = parsed.data;
    if (b.action === "review") await markBatchReviewed(id, who.profile.id);
    else if (b.action === "hold") await setBatchHold(id, true);
    else if (b.action === "resume") await setBatchHold(id, false);
    else await setBatchSendAfter(id, b.send_after);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
