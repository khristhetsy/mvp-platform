// Signature certificate: one page listing the document, its SHA-256 hash and
// the recorded trail (sent, opened, consented, signed, countersigned) with
// timestamps and IP addresses. Built with pdf-lib, attached to the executed copy.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type CertificateInput = {
  documentTitle: string;
  company: string;
  documentHash: string;
  signer: { name: string | null; email: string | null };
  countersigner: { name: string; email: string | null };
  events: { at: string; what: string; who: string | null; ip: string | null }[];
};

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildCertificate(input: CertificateInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  const navy = rgb(0.04, 0.1, 0.25);
  const grey = rgb(0.35, 0.4, 0.48);
  let y = 740;
  const line = (text: string, opts: { size?: number; f?: typeof font; color?: typeof navy; x?: number } = {}) => {
    if (y < 60) {
      page = pdf.addPage([612, 792]);
      y = 740;
    }
    page.drawText(text, { x: opts.x ?? 56, y, size: opts.size ?? 10, font: opts.f ?? font, color: opts.color ?? navy });
    y -= (opts.size ?? 10) + 7;
  };

  line("Signature Certificate", { size: 18, f: bold });
  line("iCFO Capital Global, Inc. · iCapOS e-signature", { color: grey });
  y -= 10;
  line("Document", { f: bold });
  line(`${input.documentTitle}, ${input.company}`);
  line("SHA-256 of the executed copy", { f: bold });
  for (const l of wrap(input.documentHash, 70)) line(l, { color: grey });
  y -= 6;
  line("Signer", { f: bold });
  line(`${input.signer.name ?? "—"}${input.signer.email ? ` <${input.signer.email}>` : ""}`);
  line("Countersigned by", { f: bold });
  line(`${input.countersigner.name}${input.countersigner.email ? ` <${input.countersigner.email}>` : ""}`);
  y -= 10;
  line("Audit trail (UTC)", { f: bold, size: 12 });
  for (const e of input.events) {
    const when = new Date(e.at).toISOString().replace("T", " ").slice(0, 19);
    line(`${when}   ${e.what}${e.who ? ` · ${e.who}` : ""}${e.ip ? ` · IP ${e.ip}` : ""}`, { size: 9 });
  }
  y -= 10;
  for (const l of wrap("Signatures were captured electronically after the signer accepted the ESIGN Act and UETA consent. The hash above identifies the executed copy; any change to the file changes the hash.", 100)) {
    line(l, { size: 8.5, color: grey });
  }
  return Buffer.from(await pdf.save());
}
