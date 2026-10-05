/**
 * The founder match email. Pure: returns the subject and the HTML body. The
 * shared sender (sendMarketingEmail) adds the branded header, the unsubscribe
 * link and the List-Unsubscribe headers, exactly as for every other campaign.
 *
 * Wording rule: investors *match* the founder. Never "interested": investors are
 * not contacted by this campaign.
 */
import { stageLabel } from "./fields";
import type { MaskedMatch } from "./types";

export type FounderEmailInput = {
  company: string;
  industry: string | null;
  stages: string[];
  matchCount: number;
  top: MaskedMatch[];
  networkLabel: string; // "7,000+"
  basicPrice: string; // "$49/mo"
  links: { matches: string; call: string; plan: string; privacy: string };
  postalAddress: string;
  /**
   * "classic" (default): two buttons, Schedule a call and Choose a plan.
   * "matches_first" (follow up sequence on): one button that opens the match
   * page, plus the warm intro line. Booking and plans live on the match page.
   */
  layout?: "classic" | "matches_first";
};

/** What the plan buys: the introduction, not the name. General fundraising data, not iCapOS figures. */
export const WARM_INTRO_LINE =
  "You can see who. We get you the meeting: investors take intros from us, while cold emails to investors get a first meeting about 1 to 2% of the time.";

/** Securities disclaimer on every founder Match email (day 0, review and follow ups). */
export const FOUNDER_DISCLAIMER =
  "iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. This content is for educational purposes only.";

export const DEFAULT_SUBJECT = "{match_count} investors in our network match {company}";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Fill {match_count} and {company}; other merge fields are left for the shared sender. */
export function renderSubject(template: string, v: { matchCount: number; company: string }): string {
  return template.replace(/\{\s*match_count\s*\}/gi, String(v.matchCount)).replace(/\{\s*company\s*\}/gi, v.company);
}

/** Shown only if a match has no name or firm on record. */
export const UNNAMED = "Investor";

export function matchLine(m: MaskedMatch): string {
  const sectors = m.matched_sectors?.length ? m.matched_sectors : m.sectors;
  return [m.investor_type ?? "Investor", sectors.slice(0, 2).join(", ") || null, m.stages.map(stageLabel).join(", ") || null]
    .filter(Boolean)
    .join(" · ");
}

export function renderFounderEmail(i: FounderEmailInput): string {
  const stage = i.stages.map(stageLabel).join(", ");
  const meta = [i.industry, stage].filter(Boolean).join(" · ");
  const remaining = Math.max(0, i.matchCount - i.top.length);
  const rows = i.top
    .map(
      (m) => `<tr>
  <td style="padding:12px 14px;border-top:1px solid #E3E8F2;">
    <div style="font-size:14px;font-weight:600;color:#0A1A40;">${esc(m.investor_name || UNNAMED)}${m.investor_firm ? ` <span style="font-weight:400;color:#5A6782;">· ${esc(m.investor_firm)}</span>` : ""}</div>
    <div style="font-size:12px;color:#5A6782;margin-top:2px;">${esc(matchLine(m))}</div>
  </td>
  <td style="padding:12px 14px;border-top:1px solid #E3E8F2;text-align:right;white-space:nowrap;font-size:13px;font-weight:700;color:#1A6CE4;">${m.match_score}% match</td>
</tr>`,
    )
    .join("\n");

  if (i.layout === "matches_first") {
    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0A1A40;">
  <h1 style="font-size:20px;margin:8px 0 4px;">Your investor matches</h1>
  <p style="font-size:13px;color:#5A6782;margin:0 0 16px;">${esc(i.company)}${meta ? ` · ${esc(meta)}` : ""}</p>
  <p style="font-size:14px;line-height:22px;margin:0 0 16px;">Our network of <strong>${esc(i.networkLabel)} investors</strong> has <strong>${i.matchCount} investor${i.matchCount === 1 ? "" : "s"}</strong> that fit your industry and stage.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E3E8F2;border-radius:10px;border-collapse:separate;">
${rows}
  </table>
  ${remaining > 0 ? `<p style="font-size:13px;color:#5A6782;margin:12px 0 0;">+ ${remaining} more match${remaining === 1 ? "" : "es"}</p>` : ""}
  <p style="font-size:14px;line-height:22px;margin:16px 0 0;">${esc(WARM_INTRO_LINE)}</p>
  <p style="margin:18px 0 20px;"><a href="${esc(i.links.matches)}" style="display:inline-block;background:#1A6CE4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">See my ${i.matchCount} match${i.matchCount === 1 ? "" : "es"}</a></p>
  <p style="font-size:12px;color:#8A94A8;margin:24px 0 0;line-height:18px;">Plans from ${esc(i.basicPrice)}. ${esc(i.postalAddress)}.<br />We are writing because your company is in the iCapOS founder network. Your data is handled as described in our <a href="${esc(i.links.privacy)}" style="color:#8A94A8;">privacy policy</a>.<br />${esc(FOUNDER_DISCLAIMER)}</p>
</div>`;
  }

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0A1A40;">
  <h1 style="font-size:20px;margin:8px 0 4px;">Your investor matches</h1>
  <p style="font-size:13px;color:#5A6782;margin:0 0 16px;">${esc(i.company)}${meta ? ` · ${esc(meta)}` : ""}</p>
  <p style="font-size:14px;line-height:22px;margin:0 0 16px;">We have a network of <strong>${esc(i.networkLabel)} investors</strong>. Here are your current matches: <strong>${i.matchCount} investor${i.matchCount === 1 ? "" : "s"}</strong> fit your industry and stage. Schedule a call with us to walk through them, or choose a plan to get their contact details and request introductions.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E3E8F2;border-radius:10px;border-collapse:separate;">
${rows}
  </table>
  ${remaining > 0 ? `<p style="font-size:13px;color:#5A6782;margin:12px 0 0;">&#128274; ${remaining} more match${remaining === 1 ? "" : "es"}. Contact details and Request introduction unlock with a plan.</p>` : `<p style="font-size:13px;color:#5A6782;margin:12px 0 0;">&#128274; Contact details and Request introduction unlock with a plan.</p>`}
  <p style="margin:12px 0 20px;"><a href="${esc(i.links.matches)}" style="font-size:14px;font-weight:600;color:#1A6CE4;">See all ${i.matchCount} matches &rarr;</a></p>
  <table role="presentation" cellspacing="0" cellpadding="0"><tr>
    <td style="padding-right:10px;"><a href="${esc(i.links.call)}" style="display:inline-block;background:#1A6CE4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Schedule a call with us</a></td>
    <td><a href="${esc(i.links.plan)}" style="display:inline-block;background:#ffffff;color:#1A6CE4;text-decoration:none;font-size:14px;font-weight:600;padding:10px 17px;border-radius:8px;border:1px solid #1A6CE4;">Choose a plan to unlock</a></td>
  </tr></table>
  <p style="font-size:12px;color:#8A94A8;margin:24px 0 0;line-height:18px;">Plans from ${esc(i.basicPrice)}. ${esc(i.postalAddress)}.<br />We are writing because your company is in the iCapOS founder network. Your data is handled as described in our <a href="${esc(i.links.privacy)}" style="color:#8A94A8;">privacy policy</a>.<br />${esc(FOUNDER_DISCLAIMER)}</p>
</div>`;
}

// ── Review flow ─────────────────────────────────────────────────────────────

export const REVIEW_SUBJECT = "{company}: your {match_count} investor matches";

export type ReviewEmailInput = Omit<FounderEmailInput, "links"> & {
  /** Matches open by name on the founder pages (the rest show as locked). */
  visibleCount: number;
  links: FounderEmailInput["links"] & {
    /** Profile page for the nth open match (1 based). */
    profile: (n: number) => string;
  };
};

/** "Matched on: Pre-seed, Biotechnology/Life Science". */
export function matchedOn(m: MaskedMatch, founderStages: readonly string[]): string {
  const stage = founderStages.find((s) => m.stages.includes(s)) ?? m.stages[0] ?? null;
  const sectors = (m.matched_sectors?.length ? m.matched_sectors : m.sectors).slice(0, 2);
  return [stage ? stageLabel(stage) : null, ...sectors].filter(Boolean).join(", ");
}

/**
 * The match review email: the founder's matches by name with what each matched
 * on (no match %), one primary button to book a free 15 minute match review on
 * live availability, and the plan as the secondary path. No times are written
 * into the email, so nothing goes stale between send and open.
 */
export function renderReviewEmail(i: ReviewEmailInput): string {
  const stage = i.stages.map(stageLabel).join(", ");
  const shown = i.top.slice(0, Math.min(i.top.length, i.visibleCount));
  const locked = Math.max(0, i.matchCount - Math.min(i.matchCount, i.visibleCount));
  const what = [stage, i.industry].filter(Boolean).join(" ");
  const rows = shown
    .map(
      (m, n) => `<tr>
  <td style="padding:12px 14px;border-top:${n === 0 ? "0" : "1px solid #E3E8F2"};">
    <a href="${esc(i.links.profile(n + 1))}" style="font-size:14px;font-weight:600;color:#1A6CE4;text-decoration:underline;">${esc(m.investor_name || UNNAMED)}</a>${m.investor_firm ? ` <span style="font-size:13px;color:#5A6782;">· ${esc(m.investor_firm)}</span>` : ""}
    <div style="font-size:12px;color:#5A6782;margin-top:2px;">Matched on: ${esc(matchedOn(m, i.stages))}</div>
  </td>
</tr>`,
    )
    .join("\n");

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0A1A40;">
  <p style="font-size:14px;line-height:22px;margin:8px 0 16px;">We screened our ${esc(i.networkLabel)} investor network. These investors back ${what ? `${esc(what)} ` : ""}companies like ${esc(i.company)}:</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E3E8F2;border-radius:10px;border-collapse:separate;">
${rows}
  </table>
  <p style="margin:12px 0 4px;"><a href="${esc(i.links.matches)}" style="font-size:14px;font-weight:600;color:#1A6CE4;">See all ${i.matchCount} matches</a></p>
  <p style="font-size:13px;color:#5A6782;margin:0 0 20px;">${locked > 0 ? `${locked} more match${locked === 1 ? "" : "es"} and contact details open with a plan.` : "Contact details and introductions open with a plan."}</p>
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">Which 2 should you approach first?</p>
  <p style="font-size:13px;line-height:20px;color:#5A6782;margin:0 0 14px;">In a free 15 minute match review, we'll rank all ${i.matchCount} for ${esc(i.company)}.</p>
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr>
    <td><a href="${esc(i.links.call)}" style="display:block;text-align:center;background:#1A6CE4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 18px;border-radius:8px;">Pick a time for your match review</a></td>
  </tr><tr>
    <td style="padding-top:8px;"><a href="${esc(i.links.plan)}" style="display:block;text-align:center;background:#ffffff;color:#1A6CE4;text-decoration:none;font-size:14px;font-weight:600;padding:11px 17px;border-radius:8px;border:1px solid #1A6CE4;">Choose a plan to unlock</a></td>
  </tr></table>
  <p style="font-size:13px;color:#5A6782;margin:16px 0 0;">P.S. Reply "review" and we'll send you times.</p>
  <p style="font-size:12px;color:#8A94A8;margin:24px 0 0;line-height:18px;">Plans from ${esc(i.basicPrice)}. You're receiving this because ${esc(i.company)} is listed${i.industry ? ` in ${esc(i.industry)}` : ""}${stage ? ` at ${esc(stage)}` : ""} in the iCapOS founder network. ${esc(i.postalAddress)}. Your data is handled as described in our <a href="${esc(i.links.privacy)}" style="color:#8A94A8;">privacy policy</a>.<br />${esc(FOUNDER_DISCLAIMER)}</p>
</div>`;
}
