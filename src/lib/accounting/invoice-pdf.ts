// Server only: an Accounting invoice (or receipt, once paid) as a PDF Buffer
// (pdfkit), in the same style as the Premium wire invoice PDF.

import PDFDocument from "pdfkit";
import { wireInstructionRows, type WireInstructions } from "@/lib/billing/wire-core";
import {
  ACCOUNTING_COPY, EMPTY_LETTERHEAD, STATUS_LABEL, balanceDue, displayStatus, entityDisclaimer, entityName, fmtDate,
  letterheadLines, money, type Customer, type Invoice, type InvoiceLine, type Letterhead,
} from "@/lib/accounting/core";

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const MUTED = "#64748b";
const BODY = "#1e293b";
const LINE = "#e2e8f0";

export type SeriesRow = Pick<Invoice, "invoice_number" | "issue_date" | "due_date" | "total_cents" | "status">;

export function renderInvoicePdf(input: {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: Customer;
  instructions: WireInstructions;
  series?: SeriesRow[];
  letterhead?: Letterhead;
}): Promise<Buffer> {
  const { invoice, lines, customer, instructions } = input;
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56, size: "LETTER" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      const L = 56;
      const W = 500;

      const h2 = (t: string) =>
        doc.moveDown(0.9).font("Helvetica-Bold").fontSize(9).fillColor(BLUE).text(t.toUpperCase(), L, doc.y, { characterSpacing: 0.6 }).moveDown(0.3);
      const pair = (label: string, value: string) => {
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(label, L, y, { width: 170 });
        doc.font("Helvetica").fontSize(10).fillColor(BODY).text(value, L + 180, y, { width: W - 180 });
        doc.moveDown(0.25);
      };

      const paid = invoice.status === "paid";
      const top = doc.y;
      const lh = input.letterhead ?? EMPTY_LETTERHEAD;
      let leftY = top;
      if (lh.logo) {
        try {
          const img = Buffer.from(lh.logo.slice(lh.logo.indexOf(",") + 1), "base64");
          doc.image(img, L, top, { fit: [150, 48] });
          leftY = top + 56;
        } catch (e) {
          console.warn("[accounting/pdf] logo could not be drawn", e);
        }
      }
      doc.font("Helvetica-Bold").fontSize(14).fillColor(NAVY).text(entityName(invoice.entity), L, leftY, { width: 260 });
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(letterheadLines(lh).join("\n"), L, doc.y, { width: 260 });
      const leftBottom = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE).text(paid ? "RECEIPT" : "INVOICE", L + 280, top, { width: W - 280, align: "right", characterSpacing: 1 });
      doc.font("Helvetica-Bold").fontSize(18).fillColor(NAVY).text(invoice.invoice_number, L + 280, doc.y, { width: W - 280, align: "right" });
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Issued ${fmtDate(invoice.issue_date)} · Due ${fmtDate(invoice.due_date)}`, L + 280, doc.y, { width: W - 280, align: "right" });
      doc.y = Math.max(doc.y, leftBottom, top + 60);

      h2("Bill to");
      const billTo = [customer.contact_name, customer.company, customer.email, customer.address].filter((s): s is string => Boolean(s && s.trim()));
      doc.font("Helvetica").fontSize(10).fillColor(BODY).text(billTo.join("\n"), L, doc.y, { width: W });

      // Line items
      doc.moveDown(1);
      const cols = { desc: L, qty: L + 300, unit: L + 350, amt: L + 430 };
      const headY = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED);
      doc.text("DESCRIPTION", cols.desc, headY, { width: 290 });
      doc.text("QTY", cols.qty, headY, { width: 45, align: "right" });
      doc.text("PRICE", cols.unit, headY, { width: 75, align: "right" });
      doc.text("AMOUNT", cols.amt, headY, { width: 70, align: "right" });
      doc.moveTo(L, doc.y + 4).lineTo(L + W, doc.y + 4).strokeColor(LINE).stroke();
      doc.moveDown(0.6);
      for (const l of lines) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor(BODY).text(l.description, cols.desc, y, { width: 290 });
        const after = doc.y;
        doc.text(String(Number(l.quantity)), cols.qty, y, { width: 45, align: "right" });
        doc.text(money(l.unit_cents, invoice.currency), cols.unit, y, { width: 75, align: "right" });
        doc.text(money(l.amount_cents, invoice.currency), cols.amt, y, { width: 70, align: "right" });
        doc.y = Math.max(after, doc.y) + 4;
      }
      doc.moveTo(L, doc.y).lineTo(L + W, doc.y).strokeColor(LINE).stroke();
      doc.moveDown(0.5);
      const totalRow = (label: string, value: string, bold = false) => {
        const y = doc.y;
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(bold ? NAVY : MUTED).text(label, cols.unit - 80, y, { width: 155, align: "right" });
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(bold ? NAVY : BODY).text(value, cols.amt, y, { width: 70, align: "right" });
        doc.moveDown(0.3);
      };
      totalRow("Total", money(invoice.total_cents, invoice.currency));
      if (invoice.amount_paid_cents > 0) totalRow("Paid", `-${money(invoice.amount_paid_cents, invoice.currency)}`);
      totalRow(paid ? "Balance" : "Balance due", money(balanceDue(invoice), invoice.currency), true);
      if (paid && invoice.paid_at) totalRow("Paid on", fmtDate(invoice.paid_at.slice(0, 10)));

      if (invoice.memo) {
        h2("Notes");
        doc.font("Helvetica").fontSize(10).fillColor(BODY).text(invoice.memo, L, doc.y, { width: W });
      }

      if (input.series && input.series.length > 1) {
        h2("Payment schedule");
        for (const s of input.series) pair(s.invoice_number, `${money(s.total_cents, invoice.currency)} · due ${fmtDate(s.due_date)} · ${STATUS_LABEL[displayStatus({ ...s, amount_paid_cents: 0 })]}`);
      }

      if (!paid && invoice.status !== "void") {
        h2("How to pay");
        const rows = wireInstructionRows(instructions);
        if (rows.length <= 1) {
          doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text(ACCOUNTING_COPY.noInstructions, L, doc.y, { width: W });
        } else {
          for (const r of rows) pair(r.label, r.value);
        }
        pair("Reference", invoice.invoice_number);
        doc.moveDown(0.4).font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text(ACCOUNTING_COPY.payNote, L, doc.y, { width: W });
      }

      doc.moveDown(1.2).font("Helvetica").fontSize(9).fillColor(MUTED).text(ACCOUNTING_COPY.footer, L, doc.y, { width: W });
      doc.moveDown(0.3).text(entityDisclaimer(invoice.entity), L, doc.y, { width: W });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
