// Server only: a Premium wire invoice (or receipt, once received) as a PDF
// Buffer (pdfkit), in the same style as the diligence report PDF.

import PDFDocument from "pdfkit";
import {
  WIRE_COPY, WIRE_CYCLE_LABEL, WIRE_STATUS_LABEL, wireDatePT, wireInstructionRows, wireMoney,
  type WireInstructions, type WireInvoiceRow,
} from "@/lib/billing/wire-core";

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const MUTED = "#64748b";
const BODY = "#1e293b";

export function renderWireInvoicePdf(input: {
  invoice: WireInvoiceRow;
  instructions: WireInstructions;
  billTo: { name: string | null; email: string | null; company: string | null };
}): Promise<Buffer> {
  const { invoice, instructions, billTo } = input;
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56, size: "LETTER" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const h2 = (t: string) =>
        doc.moveDown(0.9).font("Helvetica-Bold").fontSize(9).fillColor(BLUE).text(t.toUpperCase(), { characterSpacing: 0.6 }).moveDown(0.3);
      const row = (label: string, value: string) => {
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(label, 56, y, { width: 180 });
        doc.font("Helvetica").fontSize(10).fillColor(BODY).text(value, 240, y, { width: 316 });
        doc.moveDown(0.25);
      };

      const received = invoice.status === "received";
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE).text(received ? "RECEIPT" : "INVOICE", { characterSpacing: 1 });
      doc.moveDown(0.2).font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text(invoice.invoice_number);
      doc.moveDown(0.2).font("Helvetica").fontSize(10).fillColor(MUTED).text("iCFO Capital Global, Inc. · iCapOS");

      h2("Bill to");
      if (billTo.company) row("Company", billTo.company);
      if (billTo.name) row("Name", billTo.name);
      if (billTo.email) row("Email", billTo.email);

      h2("Invoice");
      row("Status", WIRE_STATUS_LABEL[invoice.status]);
      row("Plan", `Premium, ${WIRE_CYCLE_LABEL[invoice.billing_cycle].toLowerCase()}`);
      row("Amount", `${wireMoney(invoice.amount_cents)} ${invoice.currency || "USD"}`);
      row("Issued", wireDatePT(invoice.issued_at));
      row("Due", wireDatePT(invoice.due_at));
      if (invoice.period_start && invoice.period_end) row("Service period", `${wireDatePT(invoice.period_start)} to ${wireDatePT(invoice.period_end)}`);
      if (received && invoice.received_at) row("Received", wireDatePT(invoice.received_at));

      if (!received) {
        h2("Wire instructions");
        const rows = wireInstructionRows(instructions);
        if (rows.length <= 1) {
          doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text("Wire instructions are on their way from our team by email.");
        } else {
          for (const r of rows) row(r.label, r.value);
        }
        row("Reference", invoice.invoice_number);
        doc.moveDown(0.4).font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text(WIRE_COPY.reference, 56);
        doc.moveDown(0.4).font("Helvetica").fontSize(10).fillColor(BODY).text(WIRE_COPY.emailNote, 56);
      }

      doc.moveDown(1).font("Helvetica").fontSize(9).fillColor(MUTED).text(WIRE_COPY.flatFee, 56);
      doc.moveDown(0.3).text(WIRE_COPY.disclaimer, 56);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
