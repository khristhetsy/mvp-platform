import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";

export const dynamic = "force-dynamic";

// Send Contracts › Save draft / Resume: one saved send per contact. Holds the
// step, the chosen documents, unlinked fields and the cover email. Contract
// values live on contract_documents and autosave there.

const COLS = "contact_id, step, term_sheet_id, extra_ids, upload_ids, unlinked, email, updated_at, updated_by, contact:crm_contacts(name, company)";

/** GET — ?contactId= returns that contact's saved send (or null); without it, every saved send the caller can see. */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const contactId = new URL(req.url).searchParams.get("contactId");

  if (contactId) {
    if (!(await canSeeContact(actor, contactId))) return forbidden();
    const { data, error } = await actor.db.from("contract_send_drafts").select(COLS).eq("contact_id", contactId).maybeSingle();
    if (error) return NextResponse.json({ draft: null, error: error.message });
    return NextResponse.json({ draft: data ?? null });
  }

  let q = actor.db.from("contract_send_drafts").select(COLS).order("updated_at", { ascending: false }).limit(500);
  if (!actor.scope.canSeeAllContacts) {
    const { data: mine } = await actor.db.from("crm_contacts").select("id").contains("assignee_ids", [actor.userId]).limit(5000);
    const ids = ((mine ?? []) as { id: string }[]).map((r) => r.id);
    if (!ids.length) return NextResponse.json({ drafts: [] });
    q = q.in("contact_id", ids);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ drafts: [], error: error.message });
  return NextResponse.json({ drafts: data ?? [] });
}

const uuids = z.array(z.string().uuid()).max(12);
const schema = z.object({
  contactId: z.string().uuid(),
  step: z.number().int().min(1).max(3),
  termSheetId: z.string().uuid().nullable(),
  extraIds: uuids,
  uploadIds: uuids,
  unlinked: z.record(z.string(), z.array(z.string().max(120)).max(100)),
  email: z
    .object({
      subject: z.string().max(300),
      body: z.string().max(20000),
      attach: z.boolean(),
      draftId: z.string().uuid().nullable(),
      typed: z.record(z.string(), z.string().max(300)),
    })
    .nullable(),
});

/** PUT — save (or replace) this contact's send draft. */
export async function PUT(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Invalid draft.");
  const d = parsed.data;
  if (!(await canSeeContact(actor, d.contactId))) return forbidden();
  const row = {
    contact_id: d.contactId,
    step: d.step,
    term_sheet_id: d.termSheetId,
    extra_ids: d.extraIds,
    upload_ids: d.uploadIds,
    unlinked: d.unlinked,
    email: d.email,
    updated_by: actor.userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await actor.db.from("contract_send_drafts").upsert(row, { onConflict: "contact_id" }).select("updated_at").single();
  if (error) return NextResponse.json({ error: "Draft not saved. " + error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated_at: data?.updated_at ?? row.updated_at });
}

/** DELETE — ?contactId= discards the saved send (Start over). Contract drafts are kept. */
export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const contactId = new URL(req.url).searchParams.get("contactId");
  if (!contactId) return bad("Missing contact.");
  if (!(await canSeeContact(actor, contactId))) return forbidden();
  const { error } = await actor.db.from("contract_send_drafts").delete().eq("contact_id", contactId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
