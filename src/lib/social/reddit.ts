/**
 * Reddit replies — a manual channel for the Social Media Hub.
 *
 * There is no Reddit API here (the commercial API is paid). Staff answer founder
 * questions on Reddit from their own account: the hub drafts the reply from a
 * template, inserts a tracked /r/<post> link, and records the reply once posted.
 *
 * Attribution rides the existing rails: a Reddit campaign's source_tag starts with
 * "rd_", the /r/ redirect forwards to /fit?s=<tag>, the funnel records the session
 * source, and booked founders land in the CRM with lead_source = that tag.
 *
 * Everything in this file is pure (no IO) so it is unit-tested.
 */

export const REDDIT_TAG_PREFIX = "rd";
export const REDDIT_FIT_URL = "https://icapos.com/fit";
export const LINK_TOKEN = "[link]";

/** Added to every Reddit reply: replies are founder-facing material. */
export const REDDIT_DISCLAIMER =
  "Educational only, not investment advice. iCFO Capital does not solicit securities and is not an investment adviser.";

export type RedditTemplate = { key: string; label: string; body: string };
export type RedditCampaign = { id: string; name: string; source_tag: string };
export type RedditReply = { id: string; thread: string | null; thread_url: string | null; status: string; campaign_name: string | null; clicks: number; created_at: string };

export const REDDIT_TEMPLATES: RedditTemplate[] = [
  {
    key: "no_replies",
    label: "No investor replies",
    body:
      "Most cold outreach fails on fit, not on the deck. Investors filter on stage, sector, and check size before they read anything. " +
      "Before sending more emails, check whether your list actually invests at your stage.\n\n" +
      `I run a free tool that matches you to investor firms by stage and sector in about a minute, no account needed: ${LINK_TOKEN}`,
  },
  {
    key: "find_investors",
    label: "Find investors",
    body:
      "Start narrow. Ten firms that invest in your sector at your stage beat two hundred random names. " +
      "Look at who led rounds for companies one step ahead of you.\n\n" +
      `If you want a shortcut, this matches firms to your stage and sector for free: ${LINK_TOKEN}`,
  },
  {
    key: "deck_feedback",
    label: "Deck feedback (no link)",
    body:
      "Three things investors check first: is the problem specific, is there proof someone pays, and is the ask tied to milestones. " +
      "If any of those is vague, fix it before design. Happy to look closer if you share the traction slide.",
  },
];

/** True when a campaign source_tag belongs to a Reddit campaign (rd_xxxx or rd-xxxx). */
export function isRedditTag(tag: string | null | undefined): boolean {
  return /^rd[-_]/i.test(tag ?? "");
}

/** Swap the [link] token for the tracked link. A body with no token gets no link
 *  (deliberate: link-free help replies keep the Reddit account healthy). */
export function insertLink(body: string, link: string | null): string {
  if (!body.includes(LINK_TOKEN)) return body;
  return link ? body.split(LINK_TOKEN).join(link) : body.split(LINK_TOKEN).join("").replace(/[ \t]+$/gm, "");
}

/** Append the disclaimer once, as its own paragraph. */
export function withDisclaimer(body: string): string {
  const trimmed = body.trimEnd();
  if (trimmed.includes(REDDIT_DISCLAIMER)) return trimmed;
  return `${trimmed}\n\n${REDDIT_DISCLAIMER}`;
}

/** The final text staff paste on Reddit. */
export function buildReply(body: string, link: string | null): string {
  return withDisclaimer(insertLink(body, link));
}

/** Short label for a Reddit thread URL ("r/startups/abc123"), or null if it isn't one. */
export function threadLabel(url: string | null | undefined): string | null {
  const m = /reddit\.com\/(r\/[^/?#]+)\/comments\/([^/?#]+)/i.exec(url ?? "");
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Accept only Reddit thread links. */
export function isRedditThreadUrl(url: string | null | undefined): boolean {
  return threadLabel(url) !== null;
}
