import "server-only";

/**
 * Share links for the IR email dialog: a term sheet or the company data room, sent to
 * the picked investors. Each link has an unguessable token and the list of emails it was
 * sent to; the email body links to /dr/<token>?e={{email}}, and the send fills {{email}}
 * per recipient, so the page knows who opened it and lets in only those addresses while
 * the link is live. Opens and file views are logged in ir_share_views and as an activity
 * on the investor's match (once per investor, file and day).
 */
import { randomBytes } from "node:crypto";
import { db } from "@/lib/ir/db";
import { getAppUrl } from "@/lib/env";
import { getStorageBucket, PITCH_DECKS_BUCKET } from "@/lib/data/documents";
import { normShareEmail, type ShareKind } from "@/lib/ir/share-rules";

export { canOpenShare, normShareEmail, type ShareKind } from "@/lib/ir/share-rules";

export type ShareLink = {
  id: string; token: string; project_id: string; company_id: string | null; kind: ShareKind;
  document_id: string | null; file_path: string | null; file_name: string | null;
  recipients: string[]; expires_at: string | null; revoked_at: string | null; created_by: string; created_at: string;
};
export type RoomDocument = { id: string; name: string; type: string | null; size: number | null; created_at: string | null };

const ATTACH_BUCKET = "email-attachments";

/** The company's live documents (archived ones are out of the data room), newest first. */
export async function companyDocuments(companyId: string): Promise<RoomDocument[]> {
  const { data, error } = await db().from("documents").select("id, file_name, label, document_type, size_bytes, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(`companyDocuments: ${error.message}`);
  type Row = { id: string; file_name: string | null; label: string | null; document_type: string | null; size_bytes: number | null; created_at: string | null; status: string | null };
  return ((data ?? []) as Row[]).filter((d) => d.status !== "archived" && d.document_type !== "SPV_REQUIREMENT")
    .map((d) => ({ id: d.id, name: d.label || d.file_name || "Document", type: d.document_type, size: d.size_bytes, created_at: d.created_at }));
}

/** Create one link per kind for the picked investors (plus a test address when given). */
export async function createShareLinks(input: {
  projectId: string; companyId: string | null; kinds: ShareKind[]; matchIds: string[]; by: string;
  documentId?: string | null; upload?: { path: string; name: string } | null; expiresDays: number | null; testEmail?: string | null;
}): Promise<Array<{ kind: ShareKind; label: string; url: string }>> {
  const base = getAppUrl()?.replace(/\/$/, "");
  if (!base) throw new Error("The app URL isn't configured, so a link can't be made.");
  if (input.kinds.includes("data_room") && !input.companyId) throw new Error("Link the project to a company first. The data room is the company's documents.");
  if (input.kinds.includes("term_sheet") && !input.documentId && !input.upload) throw new Error("Pick or upload the term sheet first.");
  if (input.upload && !input.upload.path.startsWith(`${input.by}/`)) throw new Error("The term sheet upload couldn't be found. Upload it again.");
  if (input.documentId) {
    const { data } = await db().from("documents").select("company_id").eq("id", input.documentId).maybeSingle();
    if (!data || (data as { company_id: string }).company_id !== input.companyId) throw new Error("That document isn't one of this company's files.");
  }

  // Recipients: the picked investors' emails, read here on the server.
  const { data: ms } = input.matchIds.length ? await db().from("ir_matches").select("investor_contact_id").eq("project_id", input.projectId).in("id", input.matchIds) : { data: [] };
  const contactIds = [...new Set(((ms ?? []) as Array<{ investor_contact_id: string }>).map((m) => m.investor_contact_id))];
  const { data: cs } = contactIds.length ? await db().from("crm_contacts").select("email").in("id", contactIds) : { data: [] };
  const recipients = [...new Set([...((cs ?? []) as Array<{ email: string | null }>).map((c) => normShareEmail(c.email)), normShareEmail(input.testEmail)].filter((e) => e.includes("@")))];
  if (recipients.length === 0) throw new Error("None of the picked investors have an email address.");

  const expires = input.expiresDays ? new Date(Date.now() + input.expiresDays * 86_400_000).toISOString() : null;
  const rows = input.kinds.map((kind) => ({
    token: randomBytes(24).toString("base64url"), project_id: input.projectId, company_id: input.companyId, kind,
    document_id: kind === "term_sheet" ? input.documentId ?? null : null,
    file_path: kind === "term_sheet" && !input.documentId ? input.upload?.path ?? null : null,
    file_name: kind === "term_sheet" && !input.documentId ? input.upload?.name ?? null : null,
    recipients, expires_at: expires, created_by: input.by,
  }));
  const { error } = await db().from("ir_share_links").insert(rows);
  if (error) throw new Error(`Couldn't create the link: ${error.message}`);
  return rows.map((r) => ({ kind: r.kind, label: r.kind === "term_sheet" ? "View the term sheet" : "Open the data room", url: `${base}/dr/${r.token}?e={{email}}` }));
}

export async function loadShareLink(token: string): Promise<ShareLink | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data } = await db().from("ir_share_links").select("*").eq("token", token).maybeSingle();
  return (data as ShareLink | null) ?? null;
}

export async function companyName(companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const { data } = await db().from("companies").select("company_name").eq("id", companyId).maybeSingle();
  return (data as { company_name: string | null } | null)?.company_name ?? null;
}

/** A 5 minute signed URL for one file the link covers, or null when it isn't covered. */
export async function signedFileUrl(link: ShareLink, documentId: string): Promise<{ url: string; name: string } | null> {
  const admin = db();
  if (documentId === "file") {
    if (link.kind !== "term_sheet" || !link.file_path) return null;
    const { data } = await admin.storage.from(ATTACH_BUCKET).createSignedUrl(link.file_path, 300);
    return data?.signedUrl ? { url: data.signedUrl, name: link.file_name ?? "Term sheet" } : null;
  }
  if (link.kind === "term_sheet" && link.document_id !== documentId) return null;
  const { data: d } = await admin.from("documents").select("id, company_id, file_path, file_name, label, document_type, status").eq("id", documentId).maybeSingle();
  const doc = d as { company_id: string; file_path: string; file_name: string | null; label: string | null; document_type: string | null; status: string | null } | null;
  if (!doc || doc.company_id !== link.company_id || (link.kind === "data_room" && doc.status === "archived")) return null;
  let r = await admin.storage.from(getStorageBucket(doc.document_type ?? "")).createSignedUrl(doc.file_path, 300);
  if (r.error && /pitch_deck/i.test(doc.document_type ?? "")) r = await admin.storage.from(PITCH_DECKS_BUCKET).createSignedUrl(doc.file_path, 300);
  return r.data?.signedUrl ? { url: r.data.signedUrl, name: doc.label || doc.file_name || "Document" } : null;
}

/** Log an open or a file view; adds an activity on the investor's match once per day per file. */
export async function logShareView(link: ShareLink, email: string, action: "open" | "view", documentId: string | null, fileName: string | null): Promise<void> {
  try {
    const { data: cs } = await db().from("crm_contacts").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).limit(20);
    const ids = ((cs ?? []) as Array<{ id: string }>).map((c) => c.id);
    const { data: ms } = ids.length ? await db().from("ir_matches").select("id").eq("project_id", link.project_id).in("investor_contact_id", ids).limit(1) : { data: [] };
    const matchId = ((ms ?? []) as Array<{ id: string }>)[0]?.id ?? null;
    const docKey = documentId === "file" ? null : documentId;
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    let seen = db().from("ir_share_views").select("id", { count: "exact", head: true }).eq("link_id", link.id).eq("email", email).eq("action", action).gte("viewed_at", since.toISOString());
    seen = docKey ? seen.eq("document_id", docKey) : seen.is("document_id", null);
    const { count } = await seen;
    await db().from("ir_share_views").insert({ link_id: link.id, email, match_id: matchId, document_id: docKey, action });
    if ((count ?? 0) > 0 || !matchId) return;
    const room = link.kind === "data_room";
    const subject = action === "open" ? (room ? "Opened the data room" : "Opened the term sheet link") : room ? `Viewed ${fileName ?? "a file"} in the data room` : `Viewed the term sheet${fileName ? ` (${fileName})` : ""}`;
    await db().from("ir_activities").insert({ project_id: link.project_id, match_id: matchId, type: room ? "document" : "term_sheet", subject, outcome: `${subject} · ${email}`, done_at: new Date().toISOString(), founder_visible: false, created_by: link.created_by });
  } catch { /* logging never blocks the investor */ }
}
