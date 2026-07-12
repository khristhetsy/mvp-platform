import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { sendSequenceTest } from "@/lib/marketing/sequences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  sequence_id: z.string().uuid(),
  email: z.string().email(),
});

// POST — send every step of a sequence to a test address (preview only).
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "A sequence and a valid test email are required." }, { status: 400 });
    const result = await sendSequenceTest(parsed.data.sequence_id, parsed.data.email);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send test." }, { status: 500 });
  }
}
