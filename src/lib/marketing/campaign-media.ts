/**
 * Image, video and call to action button for a campaign email, added from the New campaign
 * wizard. Images come from the email images library (public links). A video is a pasted link
 * shown as a picture that opens the video, because most inboxes cannot play video inside an
 * email. The image or video sits at the very top of the email; the button sits after the main
 * body text. Pure helpers: they build and place the HTML and never touch the network.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** An http(s) link, trimmed, or null. Rejects javascript:, data: and anything unparsable. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type MediaInput = {
  imageUrl?: string | null;
  imageAlt?: string | null;
  /** When set the block opens this link; the image (if any) is its thumbnail. */
  videoUrl?: string | null;
};

/** The image or video block for the top of the email, or null when there is nothing usable. */
export function mediaBlockHtml({ imageUrl, imageAlt, videoUrl }: MediaInput): string | null {
  const img = safeHttpUrl(imageUrl);
  const video = safeHttpUrl(videoUrl);
  const alt = esc((imageAlt ?? "").trim() || (video ? "Watch the video" : ""));
  const imgStyle = "display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:8px 8px 0 0";
  if (video && img) {
    return `<p style="margin:0"><a href="${esc(video)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="${alt}" style="${imgStyle}"></a><a href="${esc(video)}" target="_blank" rel="noopener" style="display:inline-block;padding:8px 24px 0;font-size:13px">&#9654; Watch the video</a></p>`;
  }
  if (video) {
    return `<p style="margin:0"><a href="${esc(video)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#1A6CE4;color:#ffffff;text-decoration:none;font-weight:600">&#9654; Watch the video</a></p>`;
  }
  if (img) {
    return `<p style="margin:0"><img src="${esc(img)}" alt="${alt}" style="${imgStyle}"></p>`;
  }
  return null;
}

/** The email card: the first table about 600px wide. Its match ends where the first row goes. */
const CARD_TABLE = /<table\b[^>]*width\s*[:=]\s*"?(?:5[2-9]\d|6[0-4]\d)(?:px|"|\b)[^>]*>(?:\s*<tbody[^>]*>)?/i;
/** Designs built as a stack of 600px blocks instead of one card table. */
const STACKED_BLOCK = /<div\b[^>]*max-width:\s*600px[^>]*>/i;
const MEDIA_MARK = 'data-campaign-media="1"';
const CTA_MARK = 'data-campaign-cta="1"';
const PLACED_MEDIA = /<(tr|div) data-campaign-media="1"[^>]*>[\s\S]*?<\/\1>/gi;
const PLACED_CTA = /<(tr|div) data-campaign-cta="1"[^>]*>[\s\S]*?<\/table>\s*(?:<\/td>\s*)?<\/\1>/gi;

/**
 * Removes the thin colored bar some templates draw as the first row of the email, above the
 * headline. Only a short, empty, colored row that comes before any text or image is removed.
 */
export function removeTopAccentLine(html: string): string {
  const row = /<tr[^>]*>\s*<td[^>]*style="([^"]*)"[^>]*>(?:\s|&nbsp;)*<\/td>\s*<\/tr>/i.exec(html);
  if (!row) return html;
  const firstContent = html.search(/<(?:h[1-6]|p|img)\b/i);
  if (firstContent !== -1 && row.index > firstContent) return html;
  const style = row[1];
  const height = /(?:^|;)\s*height:\s*(\d+)px/i.exec(style);
  const color = /background(?:-color)?:\s*([^;]+)/i.exec(style)?.[1].trim().toLowerCase();
  if (!height || Number(height[1]) > 8) return html;
  if (!color || ["#fff", "#ffffff", "white", "transparent", "none"].includes(color)) return html;
  return html.slice(0, row.index) + html.slice(row.index + row[0].length);
}

/**
 * Puts the image or video at the very top of the email, above the headline and body text.
 * The email holds one: a new block replaces the last one, and null takes it out.
 */
export function placeMediaAtTop(bodyHtml: string, block: string | null): string {
  const clean = bodyHtml.replace(PLACED_MEDIA, "");
  if (!block) return clean;
  const card = CARD_TABLE.exec(clean);
  if (card) {
    const at = card.index + card[0].length;
    const pad = /<img\b/i.test(block) ? "0" : "24px 24px 0";
    return `${clean.slice(0, at)}<tr ${MEDIA_MARK}><td style="padding:${pad}">${block}</td></tr>${clean.slice(at)}`;
  }
  const stacked = STACKED_BLOCK.exec(clean);
  if (stacked) {
    return `${clean.slice(0, stacked.index)}<div ${MEDIA_MARK} style="margin:0 auto;max-width:600px">${block}</div>${clean.slice(stacked.index)}`;
  }
  return `<div ${MEDIA_MARK} style="margin:0 0 16px">${block}</div>${clean}`;
}

export const CTA_LABEL_START = "Start";
export const CTA_LABEL_AGENT = "Talk to our agent";

/**
 * The call to action button, or null without a label or a usable link. Built as a table cell
 * with its own background color and inline styles so it keeps its shape in every inbox,
 * Outlook included, and needs no comments or style sheet (both are dropped at send time).
 */
export function ctaButtonHtml({ label, url }: { label?: string | null; url?: string | null }): string | null {
  const href = safeHttpUrl(url);
  const text = (label ?? "").trim();
  if (!href || !text) return null;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1A6CE4" style="background-color:#1A6CE4;border-radius:8px"><a href="${esc(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;border:1px solid #1A6CE4;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(text)}</a></td></tr></table>`;
}

/** The rows that belong to the card table itself (not to tables nested inside it). */
function cardRows(html: string, from: number): { start: number; end: number }[] {
  const rows: { start: number; end: number }[] = [];
  const tag = /<(\/?)(table|tr)\b[^>]*>/gi;
  tag.lastIndex = from;
  let depth = 0;
  let open = -1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    const closing = m[1] === "/";
    if (m[2].toLowerCase() === "table") {
      if (closing && depth === 0) break;
      depth += closing ? -1 : 1;
    } else if (depth === 0) {
      if (!closing) open = m.index;
      else if (open !== -1) { rows.push({ start: open, end: m.index + m[0].length }); open = -1; }
    }
  }
  return rows;
}

const textOf = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Puts the button after the main body text. In a card that ends with a closing paragraph and
 * signature the button goes just above that closing row; otherwise it follows the last
 * paragraph. The email holds one button: a new one replaces the last, and null takes it out.
 */
export function placeCta(bodyHtml: string, block: string | null): string {
  const clean = bodyHtml.replace(PLACED_CTA, "");
  if (!block) return clean;
  const card = CARD_TABLE.exec(clean);
  if (card) {
    const rows = cardRows(clean, card.index + card[0].length).filter((r) => !clean.slice(r.start, r.end).includes(MEDIA_MARK));
    const withText = rows.filter((r) => /<p\b/i.test(clean.slice(r.start, r.end)));
    // Designs made of plain cells (no paragraphs): the button follows the first real paragraph of text.
    const lede = withText.length === 0 ? rows.find((r) => textOf(clean.slice(r.start, r.end)).length >= 80) : undefined;
    const last = withText[withText.length - 1] ?? lede ?? rows[rows.length - 1];
    if (last) {
      const at = withText.length > 1 ? last.start : last.end;
      // Line the button up with the text beside it: same side padding and mobile class.
      const cell = /<td\b[^>]*>/i.exec(clean.slice(last.start, last.end))?.[0] ?? "";
      const pad = /padding:\s*([^;"]+)/i.exec(cell)?.[1].trim().split(/\s+/) ?? [];
      const side = /^\d+px$/.test(pad[3] ?? pad[1] ?? "") ? (pad[3] ?? pad[1]) : "24px";
      const cls = /\bclass="([^"]*)"/i.exec(cell)?.[1];
      return `${clean.slice(0, at)}<tr ${CTA_MARK}><td${cls ? ` class="${cls}"` : ""} style="padding:12px ${side} 20px ${side}">${block}</td></tr>${clean.slice(at)}`;
    }
  }
  const wrapped = `<div ${CTA_MARK} style="margin:20px 0">${block}</div>`;
  const lastP = clean.toLowerCase().lastIndexOf("</p>");
  if (lastP === -1) return `${clean}${wrapped}`;
  const at = lastP + 4;
  return `${clean.slice(0, at)}${wrapped}${clean.slice(at)}`;
}
