import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { enrollContact } from "@/lib/marketing/sequences";

export const dynamic = "force-dynamic";

const schema = z.object({ sequenceId: z.string().uuid() });

// POST /api/sales/opportunities/[id]/enroll-sequence — manually enroll this
// opportunity's contact into a marketing sequence (same engine as stage-triggered
// enrollment). Reuses the existing sequence steps/delays/templates.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A sequence is required." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const { data: opp } = await db.from("sales_opportunities").select("contact_crm_id").eq("id", id).maybeSingle();
  const contactId = (opp?.contact_crm_id as string | null) ?? null;
  if (!contactId) {
    return NextResponse.json({ error: "This opportunity has no linked contact to enroll." }, { status: 400 });
  }
  try {
    await enrollContact(parsed.data.sequenceId, contactId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Enroll failed." }, { status: 500 });
  }
}
