// Event Email — native block model. Turns event merge data into the Marketing Hub
// block document (TemplateBlock[]) so the email can be edited inline with the same
// block editor. The locked compliance footer is appended at finalize time, so it
// can't be removed even when every content block is editable ("event ≠ offer").

import { newBlockId, renderBlocksToEmailHtml, type TemplateBlock } from "@/lib/marketing/template-blocks";
import { DEFAULT_THEME, type TemplateTheme } from "@/lib/marketing/template-theme";
import type { EventEmailType, EventMergeData } from "./merge";

const COMPLIANCE =
  "iCFO events are for education and community only. Nothing in this email is an offer to sell or a solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser, and no funding outcome is promised.";

export type EventEmailBlockOpts = { includeBanner?: boolean; includeLobby?: boolean; bookletUrl?: string };

export function eventEmailTheme(): TemplateTheme {
  return { ...DEFAULT_THEME };
}

/** Build the event email as editable Marketing blocks (compliance added at finalize). */
export function buildEventEmailBlocks(m: EventMergeData, type: EventEmailType, opts: EventEmailBlockOpts = {}): TemplateBlock[] {
  const dayOf = type === "day_of";
  const booklet = type === "booklet";
  const lobbyPrimary = dayOf || Boolean(opts.includeLobby);
  const registerLabel = type === "reminder" ? "Register now →" : booklet ? "Download the booklet (PDF) ↓" : "Register to attend →";
  const registerUrl = booklet ? (opts.bookletUrl || m.registerUrl) : m.registerUrl;
  const dateLine = `${m.dateLabel}${m.timeRange ? ` · ${m.timeRange}` : ""}`;

  const blocks: TemplateBlock[] = [];

  blocks.push({
    id: newBlockId(),
    type: "section",
    eyebrow: m.badge,
    heading: m.title,
    text: `${m.tagline ? `${m.tagline} · ` : ""}${dateLine}${m.formatLine ? ` · ${m.formatLine}` : ""}`,
    bg: "#0c2340",
    color: "#ffffff",
    headingSize: 26,
    align: "left",
    buttonLabel: registerLabel,
    buttonUrl: registerUrl,
    buttonColor: "#2E78F5",
    ...(opts.includeBanner && m.bannerUrl ? { bgImage: m.bannerUrl } : {}),
  });

  if (lobbyPrimary || opts.includeLobby) {
    blocks.push({ id: newBlockId(), type: "button", label: "Enter lobby ↗", url: m.lobbyUrl, align: "left" });
  }

  if (m.sessions.length) {
    blocks.push({ id: newBlockId(), type: "heading", text: "Agenda", level: 2, align: "left" });
    for (const s of m.sessions) {
      blocks.push({
        id: newBlockId(),
        type: "callout",
        eyebrow: s.type.replace(/_/g, " "),
        eyebrowBadge: true,
        badgeColor: s.accent,
        borderColor: s.accent,
        heading: s.title,
        text: s.abstract || "",
      });
    }
  }

  if (m.sponsorLockup) {
    blocks.push({ id: newBlockId(), type: "text", text: m.sponsorLockup, size: 12, color: "#6a7690" });
  }

  blocks.push({ id: newBlockId(), type: "divider" });
  blocks.push({ id: newBlockId(), type: "text", text: m.organizerLine, size: 12, color: "#33415a" });

  return blocks;
}

/** Render the edited blocks to email HTML, then append the locked compliance +
 *  unsubscribe footer as the final row so it always ships. */
export function finalizeEventEmailHtml(blocks: TemplateBlock[], theme?: Partial<TemplateTheme>): string {
  const html = renderBlocksToEmailHtml(blocks, theme);
  // The securities-compliance disclaimer only. The Marketing send pipeline appends
  // the working unsubscribe link + brand footer, so we don't add one here (a body
  // token like {{unsubscribe_url}} isn't interpolated and would render broken).
  const footer =
    `<tr><td style="padding:18px 24px;border-top:1px solid #e2e8f2;font-family:Arial,sans-serif;">` +
    `<div style="font-size:11px;color:#8a93a6;line-height:1.5;">${COMPLIANCE}</div>` +
    `</td></tr>`;
  const SUFFIX = "</table></td></tr></table>";
  return html.endsWith(SUFFIX) ? `${html.slice(0, -SUFFIX.length)}${footer}${SUFFIX}` : `${html}${footer}`;
}
