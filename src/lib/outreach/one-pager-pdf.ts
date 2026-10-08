// Server-only: the founder's one pager as a PDF, attached to manual outreach.
//
// Built from the same public fields the /f/<slug> page shows, never the private
// ones (contact email/phone, EBITDA, management team). pdfkit with the standard
// fonts, so it costs nothing to run and needs no browser.

import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fundsTextLines, parseUseOfFunds } from "@/lib/founder/use-of-funds";

export const ONE_PAGER_FIELDS =
  "company_name, industry, country, state, business_description, website, funding_amount, use_of_funds, revenue_stage, annual_revenue_size, key_highlights, slug, is_published";

export type OnePagerCompany = {
  company_name: string;
  industry: string | null;
  country: string | null;
  state: string | null;
  business_description: string | null;
  website: string | null;
  funding_amount: number | null;
  use_of_funds: string | null;
  revenue_stage: string | null;
  annual_revenue_size: string | null;
  key_highlights: string | null;
  slug: string | null;
  is_published: boolean | null;
};

export const ICFO_DISCLAIMER =
  "iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. This content is for educational purposes only.";

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const INK = "#1e293b";
const MUTED = "#64748b";
const RULE = "#D5D9E0";

// WinAnsi-safe text for the standard fonts.
const safe = (s: string) =>
  s
    .replace(/[→⇒]/g, "->")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[✓✔]/g, "x")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”•…€]/g, "");

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** A safe filename for the attachment, e.g. "Acme_one_pager.pdf". */
export function onePagerFileName(companyName: string): string {
  const base = companyName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Company";
  return `${base}_one_pager.pdf`;
}

export async function loadOnePagerCompany(db: SupabaseClient, companyId: string): Promise<OnePagerCompany | null> {
  const { data } = await db.from("companies").select(ONE_PAGER_FIELDS).eq("id", companyId).maybeSingle();
  return (data as OnePagerCompany | null) ?? null;
}

export function renderOnePagerPdf(c: OnePagerCompany, opts: { onlineUrl?: string | null } = {}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        // Small bottom margin so the pinned disclaimer never spills onto a new page.
        margins: { top: 50, bottom: 20, left: 50, right: 50 },
        info: { Title: `${c.company_name} one pager`, Author: c.company_name },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = 50;
      const width = doc.page.width - 100;

      const section = (title: string) => {
        doc.moveDown(0.9);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE).text(title.toUpperCase(), left, doc.y, { characterSpacing: 0.8, width });
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(10.5).fillColor(INK);
      };

      // Masthead
      doc.rect(0, 0, doc.page.width, 92).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#C9D3E3").text("ONE PAGER", left, 26, { characterSpacing: 1.2 });
      doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF").text(safe(c.company_name), left, 40, { width });
      const sub = [c.industry, [c.state, c.country].filter(Boolean).join(", ")].filter(Boolean).join("  ·  ");
      if (sub) doc.font("Helvetica").fontSize(10).fillColor("#C9D3E3").text(safe(sub), left, 68, { width });
      doc.y = 112;

      // Key facts row
      const facts: Array<[string, string]> = [];
      if (c.funding_amount && c.funding_amount > 0) facts.push(["Raising", money(c.funding_amount)]);
      if (c.revenue_stage) facts.push(["Revenue stage", c.revenue_stage]);
      if (c.annual_revenue_size) facts.push(["Annual revenue", c.annual_revenue_size]);
      if (c.website) facts.push(["Website", c.website.replace(/^https?:\/\//, "")]);
      if (facts.length) {
        const colW = width / facts.length;
        const top = doc.y;
        facts.forEach(([label, value], i) => {
          const x = left + i * colW;
          doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label.toUpperCase(), x, top, { width: colW - 8, characterSpacing: 0.5 });
          doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text(safe(value), x, top + 12, { width: colW - 8, ellipsis: true, height: 16 });
        });
        doc.y = top + 36;
        doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
      }

      if (c.business_description?.trim()) {
        section("The company");
        doc.text(safe(c.business_description.trim()), left, doc.y, { width, lineGap: 2 });
      }

      if (c.key_highlights?.trim()) {
        section("Highlights");
        doc.text(safe(c.key_highlights.trim()), left, doc.y, { width, lineGap: 2 });
      }

      if (c.use_of_funds?.trim()) {
        section("Use of funds");
        const slices = parseUseOfFunds(c.use_of_funds);
        if (slices) {
          for (const s of slices) {
            const y = doc.y;
            doc.font("Helvetica").fontSize(10).fillColor(INK).text(safe(s.label), left, y, { width: 200 });
            const barX = left + 210;
            const barW = width - 260;
            doc.rect(barX, y + 2, barW, 8).fill("#E8ECF1");
            doc.rect(barX, y + 2, Math.max(2, (barW * s.percent) / 100), 8).fill(BLUE);
            doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text(`${s.percent}%`, barX + barW + 8, y, { width: 40 });
            doc.y = y + 16;
          }
          // The founder's full text under the bars, as on the online one pager.
          doc.moveDown(0.4);
          for (const line of fundsTextLines(c.use_of_funds)) {
            const indent = line.kind === "para" ? 0 : 16;
            const y = doc.y;
            if (line.kind !== "para") {
              doc.font("Helvetica").fontSize(10.5).fillColor(MUTED).text(line.kind === "item" ? (line.marker ?? "") : "•", left, y, { width: indent });
            }
            line.parts.forEach((p, i) => {
              const opts = { width: width - indent, lineGap: 2, continued: i < line.parts.length - 1 };
              doc.font(p.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).fillColor(INK);
              if (i === 0) doc.text(safe(p.text), left + indent, y, opts);
              else doc.text(safe(p.text), opts);
            });
            doc.moveDown(0.25);
          }
          doc.font("Helvetica").fontSize(10.5).fillColor(INK);
        } else {
          doc.text(safe(c.use_of_funds.trim()), left, doc.y, { width, lineGap: 2 });
        }
      }

      if (opts.onlineUrl) {
        section("Online one pager");
        doc.fillColor(BLUE).text(opts.onlineUrl, left, doc.y, { width, link: opts.onlineUrl, underline: true });
      }

      // Footer disclaimer, pinned to the bottom of the last page.
      const footY = doc.page.height - 70;
      if (doc.y > footY - 10) doc.addPage();
      doc.moveTo(left, footY).lineTo(left + width, footY).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(ICFO_DISCLAIMER, left, footY + 6, { width });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
