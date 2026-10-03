// Prospect side: the packet behind a cover email's link. Token gated, service
// role only. Exposes only what the prospect is allowed to see: the sent
// version of each document, never drafts, tracking, notes or assignees.

import "server-only";
import type { Db } from "./access";
import { expireIfDue } from "./service";
import type { ContractDocument, ContractStatus } from "./types";

export type PacketDoc = {
  id: string;
  title: string;
  kind: string;
  entity: string | null;
  pageCount: number | null;
  status: ContractStatus;
  expiresAt: string | null;
  showExpiry: boolean;
  signUrl: string | null;
  hasExecuted: boolean;
};

export type Packet = { id: string; recipientEmail: string; recipientName: string | null; company: string | null; sentAt: string; documents: PacketDoc[] };

export async function loadPacket(db: Db, token: string): Promise<Packet | null> {
  if (!token || token.length < 32) return null;
  const { data: p } = await db.from("contract_packets").select("id, recipient_email, recipient_name, sent_at, contact:crm_contacts(company)").eq("access_token", token).maybeSingle();
  if (!p) return null;
  const { data: rows } = await db
    .from("contract_documents")
    .select("*, template:contract_templates(name, kind, has_expiry), entity:contract_entities(legal_name), request:signature_requests!contract_documents_signature_request_id_fkey(access_token)")
    .eq("packet_id", p.id)
    .order("created_at");
  const documents: PacketDoc[] = [];
  for (const row of (rows ?? []) as Array<ContractDocument & { template: { name: string; kind: string; has_expiry: boolean } | null; entity: { legal_name: string } | null; request: { access_token: string | null } | null }>) {
    const doc = await expireIfDue(db, row);
    const open = doc.status === "sent" || doc.status === "viewed";
    documents.push({
      id: row.id,
      title: row.template?.name ?? row.title ?? "Document",
      kind: row.template?.kind ?? (row.source === "upload" ? "upload" : ""),
      entity: row.entity?.legal_name ?? null,
      pageCount: row.page_count,
      status: doc.status,
      expiresAt: row.expires_at,
      // Countdown only where the document itself carries an expiration (term sheets).
      showExpiry: Boolean(row.template?.has_expiry) || row.template?.kind === "term_sheet",
      signUrl: open && row.request?.access_token ? `/sign/${row.request.access_token}` : null,
      hasExecuted: Boolean(row.executed_path),
    });
  }
  const contact = p.contact as { company: string | null } | null;
  return { id: p.id, recipientEmail: p.recipient_email, recipientName: p.recipient_name, company: contact?.company ?? null, sentAt: p.sent_at, documents };
}

/** A document in this packet (or null), for the prospect's file and respond routes. */
export async function packetDocument(db: Db, token: string, docId: string): Promise<ContractDocument | null> {
  const { data: p } = await db.from("contract_packets").select("id").eq("access_token", token).maybeSingle();
  if (!p) return null;
  const { data } = await db.from("contract_documents").select("*").eq("id", docId).eq("packet_id", p.id).maybeSingle();
  return (data as ContractDocument) ?? null;
}
