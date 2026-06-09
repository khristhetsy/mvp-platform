import { NextResponse } from "next/server";
import { track } from "@/lib/analytics/posthog";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { updateFounderInvestorContact } from "@/lib/founder-crm/contacts";
import { upsertOutreachTarget } from "@/lib/founder-crm/outreach";
import {
  notifyFounderOutreachTargetPipelined,
  notifyFounderOutreachTargetSelected,
} from "@/lib/notifications/founder-outreach-events";
import { founderOutreachTargetSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = founderOutreachTargetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid outreach target payload." }, { status: 400 });
  }

  const status = parsed.data.action === "move_to_pipeline" ? "selected" : "selected";
  const source = parsed.data.contactId ? "crm_contact" : "platform_match";

  if (parsed.data.contactId) {
    const { data: contact } = await auth.supabase
      .from("founder_investor_contacts")
      .select("id, investor_name")
      .eq("id", parsed.data.contactId)
      .eq("founder_id", auth.profile.id)
      .eq("company_id", auth.company.id)
      .maybeSingle();

    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const result = await upsertOutreachTarget(auth.supabase, {
      founderId: auth.profile.id,
      companyId: auth.company.id,
      contactId: parsed.data.contactId,
      status,
      source,
      notes: parsed.data.notes ?? null,
    });

    if (result.error || !result.data) {
      return NextResponse.json({ error: "Unable to save outreach target." }, { status: 400 });
    }

    await updateFounderInvestorContact(auth.supabase, {
      contactId: parsed.data.contactId,
      founderId: auth.profile.id,
      patch: { status: "selected" },
    });

    const displayName = contact.investor_name;
    if (parsed.data.action === "select") {
      void notifyFounderOutreachTargetSelected({
        founderId: auth.profile.id,
        targetId: result.data.id,
        displayName,
      });
    } else {
      void notifyFounderOutreachTargetPipelined({
        founderId: auth.profile.id,
        targetId: result.data.id,
        displayName,
      });
    }

    return NextResponse.json({ target: result.data, created: result.created ?? true });
  }

  const platformInvestorId = parsed.data.platformInvestorId!;
  const result = await upsertOutreachTarget(auth.supabase, {
    founderId: auth.profile.id,
    companyId: auth.company.id,
    platformInvestorId,
    matchScore: parsed.data.matchScore ?? null,
    status,
    source,
    notes: parsed.data.notes ?? null,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Unable to save outreach target." }, { status: 400 });
  }

  track("investor_matched", {
    founderId: auth.profile.id,
    companyId: auth.company.id,
    platformInvestorId,
    matchScore: parsed.data.matchScore ?? null,
  });

  const displayName = "Platform investor";
  if (parsed.data.action === "select") {
    void notifyFounderOutreachTargetSelected({
      founderId: auth.profile.id,
      targetId: result.data.id,
      displayName,
    });
  } else {
    void notifyFounderOutreachTargetPipelined({
      founderId: auth.profile.id,
      targetId: result.data.id,
      displayName,
    });
  }

  return NextResponse.json({ target: result.data, created: result.created ?? true });
}
