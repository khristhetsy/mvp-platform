/**
 * Image and video for a campaign email, added from the New campaign wizard.
 * Images come from the email images library (public links). A video is a pasted link shown
 * as a picture that opens the video, because most inboxes cannot play video inside an email.
 * Pure helpers: they build the HTML block and never touch the network.
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

/** The block to add to the email body, or null when there is nothing usable to add. */
export function mediaBlockHtml({ imageUrl, imageAlt, videoUrl }: MediaInput): string | null {
  const img = safeHttpUrl(imageUrl);
  const video = safeHttpUrl(videoUrl);
  const alt = esc((imageAlt ?? "").trim() || (video ? "Watch the video" : ""));
  if (video && img) {
    return `<p style="margin:16px 0"><a href="${esc(video)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="${alt}" style="max-width:100%;height:auto;border:0;border-radius:8px"></a><br><a href="${esc(video)}" target="_blank" rel="noopener" style="font-size:13px">&#9654; Watch the video</a></p>`;
  }
  if (video) {
    return `<p style="margin:16px 0"><a href="${esc(video)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#1A6CE4;color:#ffffff;text-decoration:none;font-weight:600">&#9654; Watch the video</a></p>`;
  }
  if (img) {
    return `<p style="margin:16px 0"><img src="${esc(img)}" alt="${alt}" style="max-width:100%;height:auto;border:0;border-radius:8px"></p>`;
  }
  return null;
}

/** Adds the block after the body. An empty block leaves the body unchanged. */
export function appendMedia(bodyHtml: string, block: string | null): string {
  return block ? `${bodyHtml}${block}` : bodyHtml;
}
