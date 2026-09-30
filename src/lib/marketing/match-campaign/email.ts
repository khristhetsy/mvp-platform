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
};

export const DEFAULT_SUBJECT = "{match_count} investors in our network match {company}";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Fill {match_count} and {company}; other merge fields are left for the shared sender. */
export function renderSubject(template: string, v: { matchCount: number; company: string }): string {
  return template.replace(/\{\s*match_count\s*\}/gi, String(v.matchCount)).replace(/\{\s*company\s*\}/gi, v.company);
}

/** A masked name: same shape for every investor so length leaks nothing. */
export const MASK = "██████████";

export function matchLine(m: MaskedMatch): string {
  return [m.investor_type ?? "Investor", m.sectors.slice(0, 2).join(", ") || null, m.stages.map(stageLabel).join(", ") || null]
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
    <div style="font-size:14px;font-weight:600;color:#0A1A40;letter-spacing:1px;">${MASK}</div>
    <div style="font-size:12px;color:#5A6782;margin-top:2px;">${esc(matchLine(m))}</div>
  </td>
  <td style="padding:12px 14px;border-top:1px solid #E3E8F2;text-align:right;white-space:nowrap;font-size:13px;font-weight:700;color:#1A6CE4;">${m.match_score}% match</td>
</tr>`,
    )
    .join("\n");

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0A1A40;">
  <h1 style="font-size:20px;margin:8px 0 4px;">Your investor matches</h1>
  <p style="font-size:13px;color:#5A6782;margin:0 0 16px;">${esc(i.company)}${meta ? ` · ${esc(meta)}` : ""}</p>
  <p style="font-size:14px;line-height:22px;margin:0 0 16px;">We have a network of <strong>${esc(i.networkLabel)} investors</strong>. Here are your current matches: <strong>${i.matchCount} investor${i.matchCount === 1 ? "" : "s"}</strong> fit your industry and stage. Schedule a call with us to walk through them, or choose a plan to see who they are and request introductions.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E3E8F2;border-radius:10px;border-collapse:separate;">
${rows}
  </table>
  ${remaining > 0 ? `<p style="font-size:13px;color:#5A6782;margin:12px 0 0;">&#128274; ${remaining} more match${remaining === 1 ? "" : "es"}. Investor names and Request introduction unlock with a plan.</p>` : `<p style="font-size:13px;color:#5A6782;margin:12px 0 0;">&#128274; Investor names and Request introduction unlock with a plan.</p>`}
  <p style="margin:12px 0 20px;"><a href="${esc(i.links.matches)}" style="font-size:14px;font-weight:600;color:#1A6CE4;">See all ${i.matchCount} matches &rarr;</a></p>
  <table role="presentation" cellspacing="0" cellpadding="0"><tr>
    <td style="padding-right:10px;"><a href="${esc(i.links.call)}" style="display:inline-block;background:#1A6CE4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Schedule a call with us</a></td>
    <td><a href="${esc(i.links.plan)}" style="display:inline-block;background:#ffffff;color:#1A6CE4;text-decoration:none;font-size:14px;font-weight:600;padding:10px 17px;border-radius:8px;border:1px solid #1A6CE4;">Choose a plan to unlock</a></td>
  </tr></table>
  <p style="font-size:12px;color:#8A94A8;margin:24px 0 0;line-height:18px;">Plans from ${esc(i.basicPrice)}. ${esc(i.postalAddress)}.<br />We are writing because your company is in the iCapOS founder network. Your data is handled as described in our <a href="${esc(i.links.privacy)}" style="color:#8A94A8;">privacy policy</a>.</p>
</div>`;
}
