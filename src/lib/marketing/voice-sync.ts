// Records a voice call as a touch on the matching Marketing Hub contact, so
// voice + email behave as one funnel. Matches by email; tags the contact and
// stamps the outcome in metadata. Best-effort — never blocks the call flow.

import { marketingDb } from "@/lib/marketing/db";

export async function recordCallTouchInMarketing(contactId: string, disposition: string, booked: boolean): Promise<void> {
  const db = marketingDb();

  const { data: crm } = await db.from("crm_contacts").select("email").eq("source", "odoo").eq("external_id", contactId).maybeSingle();
  const email = (crm as { email: string | null } | null)?.email;
  if (!email) return;

  const { data: mc } = await db.from("marketing_contacts").select("id, tags, metadata").eq("email", email).maybeSingle();
  if (!mc) return;
  const row = mc as { id: string; tags: string[] | null; metadata: Record<string, unknown> | null };

  const tags = new Set(row.tags ?? []);
  tags.add("called");
  const d = disposition.toLowerCase();
  if (booked) tags.add("call:booked");
  else if (d.includes("opt_out")) tags.add("call:opted-out");
  else tags.add(`call:${d.replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`);

  const metadata = {
    ...(row.metadata ?? {}),
    last_call_at: new Date().toISOString(),
    last_call_disposition: disposition,
    last_call_booked: booked,
  };

  await db.from("marketing_contacts").update({ tags: [...tags], metadata }).eq("id", row.id);
}
