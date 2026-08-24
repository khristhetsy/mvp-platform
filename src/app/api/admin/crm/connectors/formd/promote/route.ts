import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { promoteFiling, setFilingHeld } from "@/lib/formd/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  accessionNo: z.string().max(200),
  resolve: z.enum(["create", "link"]).optional(),
  contactId: z.string().uuid().optional(),
  held: z.boolean().optional(),
});

/**
 * Promote a filing to a CRM contact (admin only — the promote path is the only
 * writer to crm_contacts; the ingest job's role has no such grant, §10).
 * Also handles held-for-review toggling.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.held !== undefined) {
      await setFilingHeld(parsed.data.accessionNo, parsed.data.held);
      return NextResponse.json({ ok: true });
    }
    const result = await promoteFiling(parsed.data.accessionNo, profile.id, {
      resolve: parsed.data.resolve,
      contactId: parsed.data.contactId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Promote failed." }, { status: 500 });
  }
}
