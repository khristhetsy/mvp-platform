// COUNSEL-REVIEWABLE FILE — marketplace interest-list email.
//
// This email is an ISSUER communication (it tells people who expressed interest
// that an offering is live on a registered portal). The copy below is a
// PLACEHOLDER and is NOT approved legal wording. Delivery is disabled until
// MARKETPLACE_INTEREST_EMAILS_LIVE=true is set AFTER securities counsel signs off
// (mirrors INVESTOR_OUTREACH_LIVE / MATCHING_EMAILS_LIVE). Until then the
// dispatcher is a no-op and only reports how many would be notified.
//
// Tombstone-safe: facts and process only — no performance claims, no
// solicitation, no guarantee of funding/allocations/returns.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

export function marketplaceInterestEmailsEnabled(): boolean {
  return process.env.MARKETPLACE_INTEREST_EMAILS_LIVE === "true";
}

function template(companyName: string, portalName: string): { subject: string; html: string; text: string } {
  const subject = `${companyName} — offering now live on ${portalName}`;
  const body =
    `The offering you expressed interest in, ${companyName}, is now live on ${portalName}, a registered funding portal. ` +
    `Visit ${portalName} to review the offering and participate. ` +
    `iCapOS is a software platform. It is not a registered broker-dealer, funding portal, or investment adviser, ` +
    `is not involved in this offering, and does not offer, sell, or recommend securities. Investing involves risk, ` +
    `including possible loss of capital.`;
  return {
    subject,
    text: body,
    html: `<p>${body}</p>`,
  };
}

export type InterestNotifyResult = { intended: number; sent: number; live: boolean };

/**
 * Notify the interest list that a listing's offering is live on its portal.
 * Gated: no-op (reports intended count) until MARKETPLACE_INTEREST_EMAILS_LIVE.
 * Caller must have verified staff permission.
 */
export async function notifyInterestListOfferingLive(listingId: string): Promise<InterestNotifyResult> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const { data: listing } = await admin
    .from("marketplace_listings")
    .select("id, company_name, portal_name, status")
    .eq("id", listingId)
    .maybeSingle();
  const row = listing as { company_name: string; portal_name: string; status: string } | null;
  if (!row) return { intended: 0, sent: 0, live: marketplaceInterestEmailsEnabled() };

  const { data: interest } = await admin
    .from("listing_interest")
    .select("email")
    .eq("listing_id", listingId)
    .limit(5000);
  const emails = [...new Set(((interest ?? []) as Array<{ email: string }>).map((r) => r.email.toLowerCase()))];

  const live = marketplaceInterestEmailsEnabled();
  if (!live || emails.length === 0) {
    return { intended: emails.length, sent: 0, live };
  }

  const tpl = template(row.company_name, row.portal_name);
  let sent = 0;
  for (const to of emails) {
    // Individual sends — never expose the interest list to recipients.
    const ok = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (ok) sent += 1;
  }
  return { intended: emails.length, sent, live };
}
