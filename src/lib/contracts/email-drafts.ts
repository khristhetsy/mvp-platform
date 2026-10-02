// Cover email drafts, stored in the existing Marketing > Templates library
// (department "Sales", category "spv_contract"). Editing a draft during a send
// changes that send only; "Save to library" writes a new library row.

import "server-only";
import type { Db } from "./access";
import { esc } from "@/lib/email/layout";

export type EmailDraft = { id: string; name: string; description: string | null; subject: string; body: string };

const DEFAULTS: { name: string; description: string; subject: string; body: string }[] = [
  {
    name: "Proposal 1",
    description: "Convertible note, single entity",
    subject: "Proposal and term sheet for {{company}}",
    body: [
      "Hi {{first_name}},",
      "Thank you for the productive conversation. I'm pleased to share the attached term sheet outlining a proposed {{financing_amount}} convertible note financing by {{spv_name}}.",
      "The key terms are as follows:\nInterest rate: {{interest_rate}} per annum\nWarrant coverage: {{warrant_coverage}}\nConversion discount: {{conversion_discount}}\nValuation cap: {{valuation_cap}}",
      "Please review the documents through the link below. Each document is a separate agreement and may be signed on its own.",
      "Best regards,\n{{sender_name}}",
    ].join("\n\n"),
  },
  {
    name: "Proposal 2",
    description: "Series A, two entities",
    subject: "Series A term sheet and services agreement for {{company}}",
    body: [
      "Hi {{first_name}},",
      "Attached are the term sheet for a proposed {{financing_amount}} Series A Preferred financing and our Due Diligence Services Agreement.",
      "The two are independent agreements with separate iCFO entities. Each may be signed on its own, and nothing is binding until signed.",
      "Please review them through the link below, and reply with any questions.",
      "Best regards,\n{{sender_name}}",
    ].join("\n\n"),
  },
  {
    name: "Follow up resend",
    description: "Short, docs reattached",
    subject: "Following up: documents for {{company}}",
    body: [
      "Hi {{first_name}},",
      "Following up on the documents I sent for {{company}}: {{document_list}}. They are attached again for convenience, and the link below opens them for review and signature.",
      "Happy to walk through any of the terms.",
      "Best regards,\n{{sender_name}}",
    ].join("\n\n"),
  },
];

function toHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export async function listEmailDrafts(db: Db): Promise<EmailDraft[]> {
  const { data } = await db
    .from("marketing_templates")
    .select("id, name, preview_text, subject, text_body, html_body, created_at")
    .eq("category", "spv_contract")
    .neq("status", "archived")
    .order("created_at", { ascending: true });
  return ((data ?? []) as Array<Record<string, string | null>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: r.preview_text,
    subject: (r.subject as string) ?? "",
    body: (r.text_body as string) ?? "",
  }));
}

export async function saveEmailDraft(db: Db, input: { name: string; description: string | null; subject: string; body: string; userId: string }): Promise<EmailDraft> {
  const { data, error } = await db
    .from("marketing_templates")
    .insert({
      name: input.name,
      preview_text: input.description,
      subject: input.subject,
      text_body: input.body,
      html_body: toHtml(input.body),
      category: "spv_contract",
      department: "Sales",
      status: "active",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not save the draft: ${error?.message ?? "unknown error"}`);
  return { id: data.id as string, name: input.name, description: input.description, subject: input.subject, body: input.body };
}

/** Seed the three launch drafts once (with the master install). */
export async function seedEmailDrafts(db: Db, userId: string): Promise<number> {
  const existing = await listEmailDrafts(db);
  if (existing.length) return 0;
  for (const d of DEFAULTS) await saveEmailDraft(db, { ...d, userId });
  return DEFAULTS.length;
}
