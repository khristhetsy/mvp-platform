import "server-only";
import { createHash } from "node:crypto";
import { fillTokens, loadDocx, saveDocx, stripHighlights, tokensInDoc } from "@/lib/contracts/docx-engine";
import { docxToPdf } from "@/lib/contracts/render-pdf";
import { MASTER_BASE64 } from "@/lib/contracts/masters/premium-services-agreement";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";
import { NOT_A_BROKER_DEALER } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send-email";
import type { Profile } from "@/lib/supabase/types";
import {
  AGREEMENT_PLAN,
  AGREEMENT_VERSION,
  agreementDatePT,
  agreementValues,
  type AgreementDefaults,
  type AgreementInput,
} from "@/lib/billing/premium-agreement-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const FILENAME = "iCFO-Services-Agreement.pdf";

/** The filled Word file. Throws when the master holds a token that has no value, so a blank can never reach a founder. */
export async function renderAgreementDocx(input: AgreementInput, acceptedAt: string | Date): Promise<Buffer> {
  const { zip, doc } = await loadDocx(Buffer.from(MASTER_BASE64, "base64"));
  const values = agreementValues(input, acceptedAt);
  const open = tokensInDoc(doc).filter((tok) => !values[tok]);
  if (open.length) throw new Error(`Agreement field has no value: ${open.join(", ")}`);
  fillTokens(doc, values, (tok) => { throw new Error(`Agreement field has no value: ${tok}`); });
  stripHighlights(doc);
  return saveDocx(zip, doc);
}

export async function renderAgreementPdf(input: AgreementInput, acceptedAt: string | Date): Promise<Buffer> {
  return docxToPdf(await renderAgreementDocx(input, acceptedAt), FILENAME);
}

export type AcceptanceRow = {
  id: string;
  profile_id: string;
  company_id: string | null;
  agreement_version: string;
  company_name: string;
  company_address: string;
  company_email: string;
  accepted_name: string;
  accepted_title: string;
  accepted_at: string;
};

const COLUMNS = "id, profile_id, company_id, agreement_version, company_name, company_address, company_email, accepted_name, accepted_title, accepted_at";

export function inputFromRow(row: AcceptanceRow): AgreementInput {
  return {
    companyName: row.company_name,
    companyAddress: row.company_address,
    companyEmail: row.company_email,
    acceptedName: row.accepted_name,
    acceptedTitle: row.accepted_title,
  };
}

/** The founder's acceptance of the CURRENT agreement text, or null. Throws when the table cannot be read. */
export async function findCurrentAcceptance(profileId: string): Promise<AcceptanceRow | null> {
  const { data, error } = await db()
    .from("premium_agreement_acceptances")
    .select(COLUMNS)
    .eq("profile_id", profileId)
    .eq("agreement_version", AGREEMENT_VERSION)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AcceptanceRow | null) ?? null;
}

export async function findAcceptanceById(id: string): Promise<AcceptanceRow | null> {
  const { data, error } = await db().from("premium_agreement_acceptances").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AcceptanceRow | null) ?? null;
}

/** Values the checkout dialog starts with. Everything stays editable. */
export async function agreementDefaultsFor(profile: Profile): Promise<AgreementDefaults> {
  const out: AgreementDefaults = { acceptedName: profile.full_name ?? undefined, companyEmail: profile.email ?? undefined };
  try {
    const { company } = await getActiveCompanyForUser(profile);
    if (company?.company_name) out.companyName = company.company_name;
  } catch { /* defaults only */ }
  try {
    const sub = await getSubscriptionForProfile(profile.id);
    const a = sub?.billing_address as Record<string, unknown> | null | undefined;
    if (a && typeof a === "object") {
      const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
      const cityLine = [s("city"), [s("state"), s("postalCode")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const lines = [s("line1"), s("line2"), cityLine, s("country")].filter(Boolean);
      if (lines.length) out.companyAddress = lines.join("\n");
      if (!out.companyName && s("company")) out.companyName = s("company");
    }
  } catch { /* defaults only */ }
  return out;
}

export type RecordedAcceptance = { row: AcceptanceRow; pdf: Buffer; emailed: boolean };

/** Render the agreement, record the acceptance, and email the founder a copy. The render runs first so nothing is recorded that cannot be produced again. */
export async function recordAcceptance(args: { profile: Profile; input: AgreementInput; userAgent: string | null; baseUrl: string }): Promise<RecordedAcceptance> {
  const acceptedAt = new Date().toISOString();
  const pdf = await renderAgreementPdf(args.input, acceptedAt);
  let companyId: string | null = null;
  try {
    const { company } = await getActiveCompanyForUser(args.profile);
    companyId = company?.id ?? null;
  } catch { /* the acceptance stands without a company id */ }
  const { data, error } = await db()
    .from("premium_agreement_acceptances")
    .insert({
      profile_id: args.profile.id,
      company_id: companyId,
      plan_type: AGREEMENT_PLAN,
      agreement_version: AGREEMENT_VERSION,
      company_name: args.input.companyName,
      company_address: args.input.companyAddress,
      company_email: args.input.companyEmail,
      accepted_name: args.input.acceptedName,
      accepted_title: args.input.acceptedTitle,
      accepted_at: acceptedAt,
      user_agent: args.userAgent?.slice(0, 500) ?? null,
      pdf_sha256: createHash("sha256").update(pdf).digest("hex"),
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "The acceptance could not be recorded.");
  const row = data as AcceptanceRow;

  let emailed = false;
  const to = args.profile.email;
  if (to) {
    try {
      const mail = renderAgreementCopyEmail({ firstName: args.profile.full_name?.split(/\s+/)[0] ?? null, companyName: row.company_name, acceptedAt: row.accepted_at, billingUrl: `${args.baseUrl}/billing` });
      emailed = await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, attachments: [{ filename: FILENAME, content: pdf.toString("base64") }], source: "billing/premium-agreement", audience: "founder", triggeredBy: args.profile.id });
    } catch (err) {
      console.error("[premium-agreement] copy email failed (non-fatal)", err);
    }
  }
  return { row, pdf, emailed };
}

/** The email that carries the founder's copy. Pure, so a test renders what production sends. No dashes as sentence punctuation. */
export function renderAgreementCopyEmail(input: { firstName: string | null; companyName: string; acceptedAt: string; billingUrl: string }): { subject: string; html: string; text: string } {
  const subject = "Your iCFO Services Agreement";
  const date = agreementDatePT(input.acceptedAt);
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hello,";
  const body = `${hello} you accepted the iCFO Services Agreement for ${input.companyName} on ${date}. A copy is attached. It is a $1,000 monthly subscription, month to month, with no commission or finder's fee. You can cancel with 5 days written notice.`;
  const html = shell(
    `<p style="margin:0 0 14px;">${escapeHtml(body)}</p><p style="margin:0 0 14px;">You can download it again any time from your billing page.</p>${button("Open billing", input.billingUrl, true)}`,
    { audience: "founder", subject, preheader: "A copy of your Services Agreement is attached.", reason: "You are receiving this because you accepted the iCFO Services Agreement for the Premium plan.", lines: [NOT_A_BROKER_DEALER] },
  );
  return { subject, html, text: `${body}\n\nYou can download it again any time from your billing page: ${input.billingUrl}` };
}
