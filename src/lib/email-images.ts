/**
 * Email images library helpers, shared by the API routes and the picker.
 * Images live in the public `marketing-assets` bucket under `email/<year>/`.
 */

export const EMAIL_IMAGE_BUCKET = "marketing-assets";
export const EMAIL_IMAGE_PREFIX = "email";

/** Vercel caps a request body at 4.5 MB, so one upload stays under that. */
export const EMAIL_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/** Above this a warning is shown: large images load slowly in email. */
export const EMAIL_IMAGE_LARGE_BYTES = 1024 * 1024;

export const EMAIL_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type EmailImage = {
  id: string;
  name: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  created_at: string;
};

export const formatImageSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Lowercase, letters and numbers only, joined by hyphens, no extension. */
export function slugifyImageName(name: string): string {
  const base = name.replace(/\.[a-zA-Z0-9]{1,5}$/, "");
  const slug = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "image";
}

/** A new unique path for every upload, so a link never changes after it is sent. */
export function buildEmailImagePath(name: string, mime: string, id: string, now: Date = new Date()): string {
  const ext = EMAIL_IMAGE_TYPES[mime] ?? "jpg";
  return `${EMAIL_IMAGE_PREFIX}/${now.getUTCFullYear()}/${id}-${slugifyImageName(name)}.${ext}`;
}

/** The real type from the first bytes of the file, or null when it is not a supported image. */
export function sniffImageType(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export type ImageCheck = { ok: true; mime: string } | { ok: false; error: string };

/** Checks the declared type and size before the file is read. */
export function checkImageFile(file: { name: string; type: string; size: number }): ImageCheck {
  if (!(file.type in EMAIL_IMAGE_TYPES)) {
    return { ok: false, error: `${file.name}: only JPG, PNG, WebP and GIF images are allowed.` };
  }
  if (file.size <= 0) return { ok: false, error: `${file.name}: the file is empty.` };
  if (file.size > EMAIL_IMAGE_MAX_BYTES) {
    return { ok: false, error: `${file.name}: ${formatImageSize(file.size)} is over the ${formatImageSize(EMAIL_IMAGE_MAX_BYTES)} limit.` };
  }
  return { ok: true, mime: file.type };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The tag inserted into an email body: absolute https URL, alt text, full width up to 600 px. */
export function buildImgTag(url: string, alt: string, width = 600): string {
  return `<img src="${esc(url)}" alt="${esc(alt)}" width="${width}" style="display:block;max-width:100%;height:auto;border:0;">`;
}

/** Hidden markers around the banner row. Insert banner only ever touches what sits between them. */
export const BANNER_START = "<!--ICAPOS_BANNER_START-->";
export const BANNER_END = "<!--ICAPOS_BANNER_END-->";

/** The banner tag: the full width of the 600 px email card, so it fits the card edge to edge. */
export function buildBannerTag(url: string, alt: string): string {
  return `<img src="${esc(url)}" alt="${esc(alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">`;
}

/** True when the body already holds a banner block (both markers, start before end). */
export function hasBanner(html: string): boolean {
  const s = html.indexOf(BANNER_START);
  return s >= 0 && html.indexOf(BANNER_END, s + BANNER_START.length) >= 0;
}

function bannerBlock(url: string, alt: string, asRow: boolean): string {
  const img = buildBannerTag(url, alt);
  return `${BANNER_START}\n${asRow ? `<tr><td>${img}</td></tr>` : img}\n${BANNER_END}`;
}

/**
 * Puts the banner in the email body and never adds a second one.
 * - A banner block exists: only what sits between the markers is replaced.
 * - None yet: the block becomes the first row of the outer 600 px table, or, when the body
 *   has no such table, the very first thing in the body. The cursor position is never used.
 */
export function applyBanner(html: string, url: string, alt: string): string {
  const s = html.indexOf(BANNER_START);
  if (s >= 0) {
    const e = html.indexOf(BANNER_END, s + BANNER_START.length);
    if (e >= 0) {
      const inner = html.slice(s + BANNER_START.length, e);
      const asRow = /^\s*<tr[\s>]/i.test(inner);
      return html.slice(0, s) + bannerBlock(url, alt, asRow) + html.slice(e + BANNER_END.length);
    }
  }
  const table = /<table\b[^>]*(?:\bwidth\s*=\s*["']?600\b|max-width\s*:\s*600px)[^>]*>/i.exec(html);
  if (table) {
    const at = table.index + table[0].length;
    return `${html.slice(0, at)}\n${bannerBlock(url, alt, true)}\n${html.slice(at)}`;
  }
  const body = /<body\b[^>]*>/i.exec(html);
  const at = body ? body.index + body[0].length : 0;
  return `${html.slice(0, at)}${bannerBlock(url, alt, false)}\n${html.slice(at)}`;
}

/** Puts `tag` at `caret`. With no caret it goes before </body> when the body is a full document, else at the end. */
export function insertIntoHtml(html: string, tag: string, caret: number | null): string {
  if (caret !== null && caret >= 0 && caret <= html.length) return html.slice(0, caret) + tag + html.slice(caret);
  const i = html.toLowerCase().lastIndexOf("</body>");
  if (i >= 0) return html.slice(0, i) + tag + html.slice(i);
  return html + tag;
}
