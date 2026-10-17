import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { deleteFounderContact } from "@/lib/founder-crm/contact-delete";

export const dynamic = "force-dynamic";

/** Delete one of the founder's contacts. Refused once any email has been sent to them. */
export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { contactId?: unknown } | null;
  const contactId = typeof body?.contactId === "string" ? body.contactId : "";
  if (!contactId) return NextResponse.json({ error: "Missing contact." }, { status: 400 });

  const result = await deleteFounderContact(auth.supabase, {
    founderId: auth.profile.id,
    companyId: auth.company.id,
    contactId,
  });
  if (result.ok) return NextResponse.json({ ok: true, name: result.name });
  if (result.reason === "not_found") return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (result.reason === "emails_sent") {
    return NextResponse.json(
      { error: "Emails were sent to this contact, so it can only be archived.", code: "emails_sent" },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: "Couldn't delete the contact. Try again." }, { status: 500 });
}
