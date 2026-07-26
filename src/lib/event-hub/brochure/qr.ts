// Event Brochure — QR codes for the public booklet URL (§9). One UTM'd URL per
// edition; rendered onto the PDF contact page and downloadable for social posts.

import QRCode from "qrcode";

/** The UTM-tagged public booklet URL a QR points to (§9). */
export function brochureBookletUrl(baseUrl: string, editionId: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/events/brochure/${editionId}?utm_source=booklet&utm_medium=qr&utm_campaign=${editionId}`;
}

/** PNG buffer of the booklet-URL QR (for pdfkit doc.image + downloads). */
export async function brochureQrPng(baseUrl: string, editionId: string): Promise<Buffer> {
  return QRCode.toBuffer(brochureBookletUrl(baseUrl, editionId), {
    type: "png",
    margin: 1,
    width: 320,
    color: { dark: "#0c2340", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

/** data: URL of the booklet-URL QR (for the HTML preview). */
export async function brochureQrDataUrl(baseUrl: string, editionId: string): Promise<string> {
  return QRCode.toDataURL(brochureBookletUrl(baseUrl, editionId), {
    margin: 1,
    width: 220,
    color: { dark: "#0c2340", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}
