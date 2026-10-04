import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { sendPartnerTest } from "@/lib/marketing/partner-outreach/store";

export const dynamic = "force-dynamic";

const schema = z.object({ enrollment_id: z.string().uuid(), email: z.string().trim().email() });

// POST: send one partner's emails to a test address, marked [TEST]. Changes nothing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await requireRole(["admin"]).catch(() => null))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const { id } = await params;
  try {
    return NextResponse.json(await sendPartnerTest(id, parsed.data.enrollment_id, parsed.data.email));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't send the test." }, { status: 500 });
  }
}
