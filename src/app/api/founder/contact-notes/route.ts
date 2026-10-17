import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";

export const dynamic = "force-dynamic";

// founder_contact_notes isn't in the generated types, so use a raw client.
const raw = (client: unknown) => client as SupabaseClient;

/** Add a private note to one of the founder's contacts. */
export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { contactId?: unknown; body?: unknown } | null;
  const contactId = typeof body?.contactId === "string" ? body.contactId : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!contactId) return NextResponse.json({ error: "Missing contact." }, { status: 400 });
  if (!text || text.length > 4000) return NextResponse.json({ error: "Write a note up to 4,000 characters." }, { status: 400 });

  // The contact must be this founder's own, in the active company.
  const { data: contact } = await raw(auth.supabase)
    .from("founder_investor_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("founder_id", auth.profile.id)
    .eq("company_id", auth.company.id)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const { data, error } = await raw(auth.supabase)
    .from("founder_contact_notes")
    .insert({ founder_id: auth.profile.id, contact_id: contactId, body: text })
    .select("id, body, pinned, created_at")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't save the note." }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}
