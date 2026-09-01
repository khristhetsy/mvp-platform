import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
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

  // Service role: formd_firms has no RLS read policy, so a staff session can't see
  // the firm to promote (the RPC would report "firm not found"). The lawful basis
  // and OFAC hard-stop are enforced in the RPC logic regardless of the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createServiceRoleClient() as unknown as SupabaseClient<any>).rpc("promote_prospect_investor", {
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
