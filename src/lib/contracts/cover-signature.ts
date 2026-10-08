// Cover email look for contract sends: which company it goes out as (iCFO
// Capital Global or iCapOS) and whether it is a plain email, like one typed in
// Gmail, or the branded card. Pure helpers, no I/O, so they are unit tested.

export type CoverBrand = "icfo" | "icapos";
export type CoverStyle = "plain" | "branded";
export type CoverLook = { brand: CoverBrand; style: CoverStyle; signatureHtml: string };

export const COVER_COMPANY: Record<CoverBrand, string> = {
  icfo: "iCFO Capital Global, Inc.",
  icapos: "iCapOS",
};

/** Short company name for the From display name ("Khris Thetsy, iCapOS"). */
export const COVER_FROM_SUFFIX: Record<CoverBrand, string> = {
  icfo: "iCFO Capital Global",
  icapos: "iCapOS",
};

const ICFO_TAGLINE = /Elevating\s+your\s+capital\s+strategy/gi;
const ICAPOS_TAGLINE = "The operating system for capital-ready companies";

/** The iCFO disclaimer. Added when a signature does not already carry it. */
export const ICFO_DISCLAIMER_HTML =
  '<div style="font-size:10px;color:#94a3b8;margin-top:8px;line-height:1.5;">***** This e-mail, including any attachments, is solely for informational purposes, and we do not guarantee its factual content to be an accurate and complete statement of such data. iCFO does not solicit securities and is not an investment adviser. The information contained in this e-mail should not be construed as an offer or a solicitation of an offer to buy or sell any securities or other financial investments. This e-mail is intended for the addressee\'s exclusive use and may contain confidential or privileged information.</div>';

export function hasDisclaimer(html: string): boolean {
  return /solicitation of an offer/i.test(html);
}

/** The signature with the iCFO disclaimer guaranteed at the end. */
export function withDisclaimer(html: string): string {
  return hasDisclaimer(html) ? html : `${html}${ICFO_DISCLAIMER_HTML}`;
}

/**
 * The sender's own signature, re-pointed at iCapOS: company name, logo,
 * tagline and main website. Name, title, phones, email, scheduling link,
 * office links and the iCFO disclaimer stay as they are.
 */
export function toICapOSSignature(html: string, logoUrl: string): string {
  const logo = `<img src="${logoUrl}" width="150" height="42" alt="iCapOS" style="display:block;border:0;width:150px;height:42px;">`;
  let out = html;
  let swappedLogo = false;
  // The template's "iCFO" monogram badge, or the first image (the iCFO logo in a Gmail signature).
  out = out.replace(/<span[^>]*border-radius:50%[^>]*>\s*iCFO\s*<\/span>/i, () => { swappedLogo = true; return logo; });
  if (!swappedLogo) out = out.replace(/<img\b[^>]*>/i, () => { swappedLogo = true; return logo; });
  out = out
    .replace(/iCFO\s+CAPITAL\s+GLOBAL,?\s+INC\.?/gi, "iCapOS")
    .replace(ICFO_TAGLINE, ICAPOS_TAGLINE)
    // Main website only (root URL); the office pages stay on icfocapital.com.
    .replace(/href=(["'])https?:\/\/(www\.)?icfocapital\.com\/?\1/gi, 'href=$1https://icapos.com$1')
    .replace(/>(\s*)(www\.)?icfocapital\.com\/?(\s*)</gi, ">$1icapos.com$3<");
  return out;
}

/** Strip tags to text for the text/plain part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
