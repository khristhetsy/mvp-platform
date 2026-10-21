/**
 * Send a brokered introduction email to a prospect investor from iCapOS.
 * The send goes through sendEmail, so it lands in the email log (source
 * "prospect-intro"), which is what the company page Introductions card reads
 * for Sent, Delivered and Opened.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PROSPECT_ID_PREFIX } from "@/lib/matching/prospect-investors";

export const PROSPECT_INTRO_EMAIL_SOURCE = "prospect-intro";

export type ProspectIntroTarget = {
  requestId: string;
  status: string;
  note: string | null;
  companyName: string;
  founderName: string | null;
  founderFirst: string | null;
  description: string | null;
  investorName: string;
  investorFirst: string | null;
  email: string | null;
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** The request, the company, and the investor's email (prospect source_ref is the CRM contact id). */
export async function loadProspectIntroTarget(requestId: string): Promise<ProspectIntroTarget | null> {
  const client = db();
  const { data: req } = await client
    .from("prospect_intro_requests")
    .select("id, company_id, founder_id, investor_ref, status, note")
    .eq("id", requestId)
    .maybeSingle();
  const r = req as { id: string; company_id: string; founder_id: string; investor_ref: string; status: string; note: string | null } | null;
  if (!r) return null;

  const [{ data: co }, { data: fo }] = await Promise.all([
    client.from("companies").select("company_name, business_description").eq("id", r.company_id).maybeSingle(),
    client.from("profiles").select("full_name").eq("id", r.founder_id).maybeSingle(),
  ]);
  const company = co as { company_name?: string | null; business_description?: string | null } | null;
  const founderName = ((fo as { full_name?: string | null } | null)?.full_name ?? "").trim() || null;

  let investorName = "";
  let email: string | null = null;
  if (r.investor_ref.startsWith(PROSPECT_ID_PREFIX)) {
    const { data: p } = await client
      .from("prospect_investors")
      .select("name, source_ref")
      .eq("id", r.investor_ref.slice(PROSPECT_ID_PREFIX.length))
      .maybeSingle();
    const pi = p as { name?: string | null; source_ref?: string | null } | null;
    investorName = (pi?.name ?? "").trim();
    if (pi?.source_ref) {
      const { data: c } = await client.from("crm_contacts").select("name, email").eq("id", pi.source_ref).maybeSingle();
      const cc = c as { name?: string | null; email?: string | null } | null;
      email = cc?.email?.trim() || null;
      if (!investorName) investorName = (cc?.name ?? "").trim();
    }
  }

  return {
    requestId: r.id,
    status: r.status,
    note: r.note,
    companyName: company?.company_name?.trim() || "the company",
    founderName,
    founderFirst: founderName ? founderName.split(/\s+/)[0]! : null,
    description: company?.business_description?.trim() || null,
    investorName: investorName || "the investor",
    investorFirst: investorName ? investorName.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || null : null,
    email,
  };
}

/** First two sentences of a description, capped, so the draft stays short. */
function condense(text: string, max = 420): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentences = flat.match(/[^.!?]+[.!?]+/g) ?? [flat];
  const out = sentences.slice(0, 2).join(" ").trim();
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** A starting draft the admin edits before sending. Uses the founder's own note when there is one. */
export function defaultIntroDraft(t: ProspectIntroTarget, staffName: string): { subject: string; body: string } {
  const subject = `Introduction: ${t.companyName}`;
  const who = t.founderName ?? "The founder";
  const what = t.note?.trim()
    ? condense(t.note.replace(/^\s*hi[^,\n]*,\s*/i, ""), 700)
    : t.description
      ? condense(t.description)
      : `${t.companyName} is raising capital.`;
  const body = [
    `Hi ${t.investorFirst ?? "there"},`,
    "",
    `I'm ${staffName} at iCFO Capital Global. ${who} of ${t.companyName} asked me to introduce the company to you.`,
    "",
    what,
    "",
    `If you're open to a short conversation, reply here and I'll connect you both.`,
    "",
    staffName,
    "iCFO Capital Global, Inc.",
  ].join("\n");
  return { subject, body };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text to simple HTML paragraphs. */
export function introHtml(body: string): string {
  const paras = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;">${paras}</div>`;
}
