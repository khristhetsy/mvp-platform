// Preview and Send test for the contract send step. Read only on the contract
// records: nothing here locks a document, creates a packet or a signing link,
// or writes to the prospect's timeline. The checks match sendPacket, so a
// preview or test that works means the real send will pass the same checks.

import "server-only";
import type { Db } from "./access";
import { bundleOpenFields, fileBase, loadBundle, renderBundlePdf, SendBlockedError, type SendInput } from "./service";
import { applyEmailTokens, emailTokenValues, withTypedValues } from "./email-tokens";
import { resolveCoverLook } from "./cover-look";
import { appBase, buildCoverEmail, buildTestCoverEmail, sendTestCoverEmail, type Attachment } from "./email";

export type ComposeInput = Omit<SendInput, "sender" | "emailDraftId"> & { senderName: string; userId: string };

async function compose(db: Db, input: ComposeInput) {
  if (!input.documentIds.length) throw new SendBlockedError("Choose at least one document.");
  const bundles = [];
  for (const id of input.documentIds) {
    const b = await loadBundle(db, id);
    if (!b || b.doc.contact_id !== input.contactId) throw new SendBlockedError("A document does not belong to this contact.");
    if (b.doc.locked || b.doc.status !== "draft") throw new SendBlockedError(`${b.template.name} was already sent. Edit it to create a new version.`);
    bundles.push(b);
  }
  const contact = bundles[0].contact;
  if (!contact.email) throw new SendBlockedError("This contact has no email address.");
  const open = bundles.flatMap((b) => bundleOpenFields(b).map((f) => `${b.template.name}: ${f.label}`));
  if (open.length) throw new SendBlockedError(`Fill the open fields first: ${open.join("; ")}.`, { open });

  const tokenValues = withTypedValues(
    emailTokenValues({
      contactName: contact.name,
      company: contact.company,
      senderName: input.senderName,
      documents: bundles.map((b) => ({ fields: b.fields, values: b.doc.field_values, entityName: b.entity?.legal_name ?? null, title: b.template.name })),
    }),
    input.typedValues,
  );
  const subject = applyEmailTokens(input.subject, tokenValues);
  const body = applyEmailTokens(input.body, tokenValues);
  const missing = [...new Set([...subject.missing, ...body.missing])];
  if (missing.length) throw new SendBlockedError(`The email uses tokens with no value: ${missing.map((m) => `{{${m}}}`).join(", ")}.`, { missing });
  if (!subject.text.trim() || !body.text.trim()) throw new SendBlockedError("The cover email needs a subject and a body.");

  const signature = input.signature !== false;
  // Same rule as the real send: review only always attaches the PDFs.
  const attachPdfs = signature ? input.attachPdfs : true;
  return { bundles, contact, subject: subject.text, body: body.text, signature, attachPdfs };
}

export type SendPreview = {
  to: string;
  toName: string;
  subject: string;
  html: string;
  signature: boolean;
  attachments: Array<{ documentId: string; filename: string; title: string }>;
};

/** The email exactly as the prospect would get it, without rendering or sending anything. */
export async function previewSend(db: Db, input: ComposeInput): Promise<SendPreview> {
  const c = await compose(db, input);
  // The signing link only exists once the real send runs; the preview points nowhere.
  const look = await resolveCoverLook(input.userId, input.brand ?? "icfo", input.style ?? "plain");
  const mail = buildCoverEmail({ subject: c.subject, body: c.body, url: "#", senderName: input.senderName, reviewOnly: !c.signature, look });
  return {
    to: c.contact.email!,
    toName: c.contact.name,
    subject: mail.subject,
    html: mail.html,
    signature: c.signature,
    attachments: c.attachPdfs ? c.bundles.map((b) => ({ documentId: b.doc.id, filename: `${fileBase(b)}.pdf`, title: b.template.name })) : [],
  };
}

/** Sends a test copy, with the real PDFs, to the sender only. */
export async function sendTest(db: Db, input: ComposeInput & { senderEmail: string | null; via: "gmail" | "icapos" }): Promise<{ to: string; delivered: boolean; attachments: number }> {
  if (!input.senderEmail) throw new SendBlockedError("Your profile has no email address to send the test to.");
  const c = await compose(db, input);
  const attachments: Attachment[] = [];
  if (c.attachPdfs) for (const b of c.bundles) attachments.push({ filename: `${fileBase(b)}.pdf`, content: await renderBundlePdf(db, b, "final") });
  const look = await resolveCoverLook(input.userId, input.brand ?? "icfo", input.style ?? "plain");
  const mail = buildTestCoverEmail({
    look,
    subject: c.subject,
    body: c.body,
    senderName: input.senderName,
    reviewOnly: !c.signature,
    backUrl: `${appBase()}/admin/sales/contracts/send?contact=${encodeURIComponent(input.contactId)}`,
    prospectName: c.contact.name,
  });
  const { delivered } = await sendTestCoverEmail({ via: input.via, userId: input.userId, to: input.senderEmail, senderName: input.senderName, senderEmail: input.senderEmail, mail, attachments, look });
  return { to: input.senderEmail, delivered, attachments: attachments.length };
}
