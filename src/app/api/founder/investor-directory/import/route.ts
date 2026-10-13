/**
 * Import directory investors into the founder's address book (shown in Manual
 * outreach under "From investor directory").
 *   POST { ids: string[] } → { imported, alreadyHeld, unavailable, trimmedBy, access }
 * Gate order: suspended/paused → terms → free plan → daily cap → hold limit.
 * Form D firms (no contact email) skip the hold limit: they don't count.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { formdIdsAmong, importIntoContacts, loadFounderAccess, loadSettings, maybeAutoPause } from "@/lib/investor-directory/db";
import { decideSplitImport } from "@/lib/investor-directory/limits";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(5000) });

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select investors to import." }, { status: 400 });
  try {
    const settings = await loadSettings();
    // A high bounce rate pauses imports before the next batch goes in.
    await maybeAutoPause(auth.profile.id, settings);
    const access = await loadFounderAccess(auth.profile.id, auth.company.id);
    // Form D firms have no contact email, so they don't count toward the plan's limit.
    const formd = await formdIdsAmong(parsed.data.ids);
    const decision = decideSplitImport(parsed.data.ids, formd, access, settings);
    if (!decision.ok) return NextResponse.json({ error: decision.message, reason: decision.reason, access }, { status: 403 });
    const result = await importIntoContacts({ founderId: auth.profile.id, companyId: auth.company.id, ids: decision.ids, limit: decision.limit });
    const after = await loadFounderAccess(auth.profile.id, auth.company.id);
    return NextResponse.json({ ...result, trimmedBy: decision.trimmedBy, access: after });
  } catch (err) {
    console.error("[investor-directory] import failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't import those investors. Try again." }, { status: 500 });
  }
}
