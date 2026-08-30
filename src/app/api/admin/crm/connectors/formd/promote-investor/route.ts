import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mirrorInvestorToContacts } from "@/lib/formd/mirror-investor-contact";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// §9 — deliberately a SEPARATE promote path from the founder-side promote route.
// Calls promote_prospect_investor() (SECURITY INVOKER) as the authenticated staff
// user; the RPC runs the dedupe cascade, the OFAC hard-stop, and records the GDPR
// lawful basis. A lawful basis is required at promote time (§15).
const schema = z.object({
  firmId: z.string().uuid(),
  lawfulBasis: z.string().min(1).max(200),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A firm id and lawful basis are required." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  // The RPC isn't in the generated types yet, so call it through an untyped client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as unknown as SupabaseClient<any>).rpc("promote_prospect_investor", {
    p_firm_id: parsed.data.firmId,
    p_lawful_basis: parsed.data.lawfulBasis,
  });

  if (error) {
    // OFAC hard-stop and other guards surface here as a Postgres exception.
    const blocked = /ofac/i.test(error.message);
    return NextResponse.json({ error: error.message }, { status: blocked ? 409 : 400 });
  }

  // Mirror into crm_contacts (Investors group) unless it was only held for review.
  const action = (data as { action?: string } | null)?.action;
  if (action && action !== "review") {
    await mirrorInvestorToContacts(parsed.data.firmId, profile.id).catch(() => {});
  }
  return NextResponse.json(data ?? { ok: true });
}
