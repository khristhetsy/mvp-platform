/**
 * Deal notices: the email a matched investor in the iCFO network gets when a
 * founder completes due diligence, and the opt in page it links to.
 *
 * Rules carried from the approved plan:
 *  - Only companies whose listing checklist is complete are noticed.
 *  - Investors decide: the notice shows the CRR as it is, whatever the score.
 *  - Investors are always free. Viewing the deal creates a free account.
 *  - Unsubscribed or suppressed contacts are skipped, and demo or internal
 *    founder accounts never email real investors.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emailConfigured, makeUnsubscribeToken, sendMarketingEmail } from "@/lib/marketing/send";
import { firstValidEmail } from "@/lib/marketing/recipient";
import { crrScoresFor } from "@/lib/crr/crr-for";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export const DEAL_NOTICE_FROM_NAME = "iCFO Capital Investor Relations";
export const DEAL_NOTICE_FROM_EMAIL = "outreach@mail.myicfos.com";

export type DealSummary = {
  companyId: string;
  companyName: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  raising: string | null;
  description: string | null;
  crr: number | null;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function raisingLabel(amount: number | null | undefined, band: string | null | undefined): string | null {
  if (typeof amount === "number" && amount > 0) return `Raising ${money(amount)}`;
  if (band && band.trim()) return `Raising ${band.trim()}`;
  return null;
}

/** Subject line: what fits the investor's focus, never a performance claim. */
export function dealNoticeSubject(d: DealSummary): string {
  const focus = [d.industry, d.stage].filter(Boolean).join(", ");
  return focus ? `New diligence complete deal in ${focus}` : "New diligence complete deal in your focus";
}

/** Pure: the notice body. Plain HTML so it renders in every inbox. */
export function dealNoticeHtml(d: DealSummary, viewUrl: string): string {
  const meta = [d.industry, d.stage, d.location, d.raising].filter(Boolean).map((s) => escapeHtml(String(s))).join(" · ");
  const crr = d.crr == null ? "Not yet scored" : `CRR ${d.crr}`;
  const desc = d.description ? `<p style="margin:8px 0 0;font-size:14px;color:#4A5570;">${escapeHtml(d.description.slice(0, 280))}${d.description.length > 280 ? "…" : ""}</p>` : "";
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#16223F;line-height:1.6;font-size:15px;">
<p>Hi {{first_name}},</p>
<p>A company matching your investment focus just completed AI due diligence on iCapOS.</p>
<div style="background:#F4F6FA;border-radius:8px;padding:14px 16px;margin:14px 0;">
  <table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
    <td style="font-size:16px;font-weight:bold;color:#0A1A40;">${escapeHtml(d.companyName)}</td>
    <td style="text-align:right;font-size:15px;font-weight:bold;color:#0A1A40;">${crr}</td>
  </tr></table>
  ${meta ? `<p style="margin:4px 0 0;font-size:13px;color:#4A5570;">${meta}</p>` : ""}
  ${desc}
  <p style="margin:10px 0 0;font-size:12px;color:#1F6B3A;font-weight:bold;">Diligence complete · Founder attested figures</p>
</div>
<p style="margin:18px 0;"><a href="${viewUrl}" style="display:inline-block;background:#1A6CE4;color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View the deal, free</a></p>
<p style="font-size:13px;color:#4A5570;">Viewing creates your free investor account. Investors never pay on iCapOS.</p>
<p style="margin-top:22px;font-size:11px;color:#8A93A8;">You received this because the company matches your investment focus. iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.</p>
</div>`;
}

export function dealViewUrl(token: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com"): string {
  return `${appUrl}/deal/${encodeURIComponent(token)}`;
}

/** One company's listing summary, the only thing a notice or opt in page shows. */
export async function loadDealSummary(companyId: string, db: Db = createServiceRoleClient()): Promise<DealSummary | null> {
  const { data: c } = await db
    .from("companies")
    .select("id, company_name, industry, funding_stage, state, country, funding_amount, funding_amount_band, business_description, listing_completed_at, listing_opt_in_at, is_sample")
    .eq("id", companyId)
    .maybeSingle();
  // Only a company still listed in the Private Market is shown or noticed.
  if (!c || !c.listing_completed_at || !c.listing_opt_in_at || c.is_sample === true) return null;
  const scores = await crrScoresFor([companyId]);
  return {
    companyId,
    companyName: c.company_name ?? "Company",
    industry: c.industry ?? null,
    stage: c.funding_stage ?? null,
    location: [c.state, c.country].filter(Boolean).join(", ") || null,
    raising: raisingLabel(c.funding_amount, c.funding_amount_band),
    description: c.business_description ?? null,
    crr: scores.get(companyId) ?? null,
  };
}

export type SendNoticesResult = { sent: number; skipped: number; failed: number; remaining: number };

/**
 * Sends queued notices, oldest first, in batches. Called from Marketing > Deal
 * notices. Founders whose account cannot dispatch email (demo or internal) have
 * their notices skipped, never sent.
 */
export async function sendQueuedDealNotices(opts: { companyId?: string | null; limit?: number } = {}): Promise<SendNoticesResult> {
  const db: Db = createServiceRoleClient();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 300);
  let q = db
    .from("listing_deal_notices")
    .select("id, company_id, crm_contact_id, token")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (opts.companyId) q = q.eq("company_id", opts.companyId);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const notices = (rows ?? []) as Array<{ id: string; company_id: string; crm_contact_id: string; token: string }>;
  const result: SendNoticesResult = { sent: 0, skipped: 0, failed: 0, remaining: 0 };
  if (!notices.length) return result;
  if (!emailConfigured()) throw new Error("Email is not configured (RESEND_API_KEY), so nothing was sent.");

  const contactIds = [...new Set(notices.map((n) => n.crm_contact_id))];
  const companyIds = [...new Set(notices.map((n) => n.company_id))];
  const [{ data: contacts }, { data: companies }] = await Promise.all([
    db.from("crm_contacts").select("id, name, email, suppressed").in("id", contactIds),
    db.from("companies").select("id, founder_id").in("id", companyIds),
  ]);
  const contactById = new Map(((contacts ?? []) as Array<{ id: string; name: string | null; email: string | null; suppressed: boolean | null }>).map((c) => [c.id, c]));

  const { unsubscribedEmails } = await import("@/lib/verify/suppression");
  // Check both the stored value and the address actually sent to (a contact can hold several).
  const unsub = await unsubscribedEmails(db, [...contactById.values()].flatMap((c) => [c.email, firstValidEmail(c.email ?? "") || null]));

  const { emailDispatchAllowedForUser } = await import("@/lib/organizations/organizations");
  const dispatchByCompany = new Map<string, boolean>();
  for (const c of (companies ?? []) as Array<{ id: string; founder_id: string | null }>) {
    dispatchByCompany.set(c.id, c.founder_id ? await emailDispatchAllowedForUser(db, c.founder_id) : false);
  }
  const summaries = new Map<string, DealSummary | null>();
  for (const id of companyIds) summaries.set(id, await loadDealSummary(id, db));

  for (const n of notices) {
    const now = new Date().toISOString();
    const contact = contactById.get(n.crm_contact_id);
    const to = firstValidEmail(contact?.email ?? "");
    const summary = summaries.get(n.company_id) ?? null;
    let skip: string | null = null;
    if (!dispatchByCompany.get(n.company_id)) skip = "Demo or internal founder account: email dispatch is off";
    else if (!summary) skip = "Company not found or no longer listed";
    else if (!contact || !to) skip = "No valid email";
    else if (contact.suppressed || unsub.has(to.trim().toLowerCase()) || unsub.has((contact.email ?? "").trim().toLowerCase())) skip = "Unsubscribed";
    if (skip || !summary || !to) {
      await db.from("listing_deal_notices").update({ status: "skipped", error: skip }).eq("id", n.id);
      result.skipped++;
      continue;
    }
    const first = (contact?.name ?? "").trim().split(/\s+/)[0] || "there";
    const res = await sendMarketingEmail({
      to,
      first_name: first,
      from_name: DEAL_NOTICE_FROM_NAME,
      from_email: DEAL_NOTICE_FROM_EMAIL,
      subject: dealNoticeSubject(summary),
      html_body: dealNoticeHtml(summary, dealViewUrl(n.token)),
      unsubscribe_token: makeUnsubscribeToken(to),
    });
    if (res.ok) {
      await db.from("listing_deal_notices").update({ status: "sent", sent_at: now, error: null }).eq("id", n.id);
      result.sent++;
    } else {
      await db.from("listing_deal_notices").update({ status: "failed", error: res.error ?? "Send failed" }).eq("id", n.id);
      result.failed++;
    }
  }

  let rq = db.from("listing_deal_notices").select("id", { count: "exact", head: true }).eq("status", "queued");
  if (opts.companyId) rq = rq.eq("company_id", opts.companyId);
  const { count } = await rq;
  result.remaining = count ?? 0;
  return result;
}

export type NoticeForView = {
  id: string;
  companyId: string;
  email: string | null;
  name: string | null;
  optedInAt: string | null;
};

/** Resolves a notice token for the opt in page and records the first view. */
export async function openDealNotice(token: string): Promise<{ notice: NoticeForView; summary: DealSummary } | null> {
  if (!token || token.length > 64) return null;
  const db: Db = createServiceRoleClient();
  const { data: n } = await db
    .from("listing_deal_notices")
    .select("id, company_id, crm_contact_id, viewed_at, opted_in_at")
    .eq("token", token)
    .maybeSingle();
  if (!n) return null;
  if (!n.viewed_at) await db.from("listing_deal_notices").update({ viewed_at: new Date().toISOString() }).eq("id", n.id);
  const [{ data: contact }, summary] = await Promise.all([
    db.from("crm_contacts").select("name, email").eq("id", n.crm_contact_id).maybeSingle(),
    loadDealSummary(n.company_id, db),
  ]);
  if (!summary) return null;
  return {
    notice: { id: n.id, companyId: n.company_id, email: contact?.email ?? null, name: contact?.name ?? null, optedInAt: n.opted_in_at ?? null },
    summary,
  };
}

/**
 * The investor clicked "View the full deal": record the opt in once and tell
 * the founder an investor viewed their deal (identity shown only on a plan that
 * reveals investors, see the founder interest page).
 */
export async function optInToDealNotice(token: string): Promise<{ companyId: string; email: string | null } | null> {
  const db: Db = createServiceRoleClient();
  const { data: n } = await db
    .from("listing_deal_notices")
    .select("id, company_id, crm_contact_id, opted_in_at")
    .eq("token", token)
    .maybeSingle();
  if (!n) return null;
  const { data: co } = await db
    .from("companies")
    .select("listing_completed_at, listing_opt_in_at, is_sample")
    .eq("id", n.company_id)
    .maybeSingle();
  if (!co || !co.listing_completed_at || !co.listing_opt_in_at || co.is_sample === true) return null;
  const { data: contact } = await db.from("crm_contacts").select("email").eq("id", n.crm_contact_id).maybeSingle();
  if (!n.opted_in_at) {
    await db.from("listing_deal_notices").update({ opted_in_at: new Date().toISOString() }).eq("id", n.id);
    try {
      const { notifyCompanyFounder } = await import("@/lib/notifications/notifications");
      await notifyCompanyFounder(n.company_id, {
        type: "investor_interest",
        title: "An investor viewed your deal",
        message: "A matched investor from our network opted in to see your full deal.",
        entityType: "company",
        entityId: n.company_id,
        deepLink: "/founder/investor-interest",
      });
    } catch {
      // Never block the investor on a notification.
    }
  }
  return { companyId: n.company_id, email: contact?.email ?? null };
}
