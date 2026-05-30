import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { generateOutreachDraft } from "@/lib/founder-crm/outreach-drafts";
import { evaluateFounderOutreachReadiness } from "@/lib/founder-crm/outreach-readiness";
import { notifyFounderOutreachBlocked } from "@/lib/notifications/founder-outreach-events";
import { outreachDraftSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = outreachDraftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft request." }, { status: 400 });
  }

  const readiness = await evaluateFounderOutreachReadiness(auth.company, auth.profile.id);
  if (!readiness.allowed) {
    const reason = readiness.requirements.find((row) => !row.met)?.label ?? "Outreach readiness not met.";
    void notifyFounderOutreachBlocked({ founderId: auth.profile.id, reason });
    return NextResponse.json({ error: reason, readiness }, { status: 403 });
  }

  const { data: contact, error } = await auth.supabase
    .from("founder_investor_contacts")
    .select("*")
    .eq("id", parsed.data.contactId)
    .eq("founder_id", auth.profile.id)
    .maybeSingle();

  if (error || !contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const draft = generateOutreachDraft({
    kind: parsed.data.kind,
    company: auth.company,
    contact,
    readinessScore: readiness.readinessScore,
    founderName: auth.profile.full_name,
  });

  return NextResponse.json({ draft });
}
