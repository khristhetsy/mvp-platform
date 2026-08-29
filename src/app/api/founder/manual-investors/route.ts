import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createManualInvestor, listManualInvestors, MANUAL_INVESTOR_SOURCES } from "@/lib/founder/manual-investors";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(160),
  firm: z.string().max(160).nullish(),
  email: z.string().email().max(200).nullish().or(z.literal("")),
  source: z.enum(MANUAL_INVESTOR_SOURCES).nullish(),
  checkSize: z.string().max(60).nullish(),
  notes: z.string().max(2000).nullish(),
  invited: z.boolean().optional(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ investors: [] });
  const supabase = await createServerSupabaseClient();
  return NextResponse.json({ investors: await listManualInvestors(supabase, company.id) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ error: "Add your company before tracking investors." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "An investor name is required." }, { status: 400 });

  // An invite requires an email to send it to.
  const invited = Boolean(parsed.data.invited && parsed.data.email);

  const supabase = await createServerSupabaseClient();
  const result = await createManualInvestor(supabase, {
    companyId: company.id,
    founderId: profile.id,
    name: parsed.data.name,
    firm: parsed.data.firm ?? null,
    email: parsed.data.email || null,
    source: parsed.data.source ?? null,
    checkSize: parsed.data.checkSize ?? null,
    notes: parsed.data.notes ?? null,
    invited,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
