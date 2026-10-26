// Manager acceptance: loads a package's signing state and records acceptance.
// Server only. No funds are held, moved or confirmed here.

import "server-only";
import type { Db } from "../access";
import { sendAcceptanceEmail, notifySender } from "../email";
import { addEvent } from "../store";
import { loadBundle, SendBlockedError } from "../service";
import { acceptanceState, type AcceptanceDoc, type AcceptanceState } from "./acceptance";

export type AcceptanceView = AcceptanceState & { acceptedAt: string | null; recipientEmail: string | null; documents: AcceptanceDoc[] };

type Row = { id: string; status: AcceptanceDoc["status"]; template: { name: string; kind: string; part_key: string | null; delivery: "sign" | "review" } | null };

async function packageDocs(db: Db, packetId: string): Promise<AcceptanceDoc[]> {
  const { data } = await db.from("contract_documents").select("id, status, template:contract_templates(name, kind, part_key, delivery)").eq("packet_id", packetId).order("created_at");
  return ((data ?? []) as Row[])
    .filter((r) => r.template?.kind === "subscription")
    .map((r) => ({ id: r.id, name: r.template!.name, partKey: r.template!.part_key, delivery: r.template!.delivery, status: r.status }));
}

async function acceptedAtFor(db: Db, ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const { data } = await db.from("contract_events").select("created_at").in("contract_document_id", ids).eq("kind", "manager_accepted").order("created_at").limit(1);
  return (data?.[0]?.created_at as string | undefined) ?? null;
}

/** Signing and acceptance state of the package a document was sent in (null when it is not a sent subscription package). */
export async function acceptanceFor(db: Db, docId: string): Promise<AcceptanceView | null> {
  const b = await loadBundle(db, docId);
  if (!b || b.template.kind !== "subscription" || !b.doc.packet_id) return null;
  const documents = await packageDocs(db, b.doc.packet_id);
  const acceptedAt = await acceptedAtFor(db, documents.map((d) => d.id));
  const { data: packet } = await db.from("contract_packets").select("recipient_email").eq("id", b.doc.packet_id).maybeSingle();
  return { ...acceptanceState(documents, acceptedAt), acceptedAt, recipientEmail: (packet?.recipient_email as string | undefined) ?? null, documents };
}

/** The Manager accepts the subscription: recorded on every signing document, then the subscriber is told what comes next. */
export async function acceptSubscription(db: Db, docId: string, by: { actorLabel: string; displayName: string; email: string | null }): Promise<{ emailed: boolean }> {
  const b = await loadBundle(db, docId);
  if (!b || b.template.kind !== "subscription" || !b.doc.packet_id) throw new SendBlockedError("This is not a sent subscription package.");
  const documents = await packageDocs(db, b.doc.packet_id);
  const acceptedAt = await acceptedAtFor(db, documents.map((d) => d.id));
  if (acceptedAt) throw new SendBlockedError("This subscription was already accepted.");
  const state = acceptanceState(documents, null);
  if (!state.canAccept) throw new SendBlockedError(state.blocker ?? "The subscription cannot be accepted yet.");

  for (const d of documents.filter((x) => x.delivery === "sign")) await addEvent(db, d.id, "manager_accepted", by.actorLabel, { by: by.displayName });

  const { data: packet } = await db.from("contract_packets").select("access_token, recipient_email, recipient_name").eq("id", b.doc.packet_id).maybeSingle();
  let emailed = false;
  if (packet) {
    const spv = b.doc.field_values?.spv_name || b.contact.company || "the Fund";
    try {
      const r = await sendAcceptanceEmail({
        to: packet.recipient_email as string,
        firstName: (packet.recipient_name as string | null)?.split(/\s+/)[0] ?? null,
        fund: spv,
        senderName: by.displayName,
        senderEmail: by.email,
        token: packet.access_token as string,
      });
      emailed = r.delivered;
    } catch {
      emailed = false;
    }
    await addEvent(db, docId, emailed ? "acceptance_email_sent" : "acceptance_email_not_sent", "system");
  }
  if (by.email) await notifySender({ to: by.email, subject: `Subscription accepted: ${b.contact.company ?? b.contact.name}`, lines: [`You accepted the subscription of ${b.contact.company ?? b.contact.name}.`, emailed ? "The subscriber was emailed the next step." : "The email did not go out. Tell the subscriber to follow the Subscription Instructions."], url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/sales/contracts/${docId}` }).catch(() => null);
  return { emailed };
}
