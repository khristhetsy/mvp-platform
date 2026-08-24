// Event Brochure — PDF renderer (build spec §8). Uses pdfkit (vector, no browser
// engine required — deployable in a Node/Vercel function). Produces a print
// variant (0.125in bleed + crop marks) and a compressed digital variant from the
// same layout code. Locked disclaimers/footer/compliance are hard-coded here too.

import PDFDocument from "pdfkit";
import type { EventMergeData } from "@/lib/event-email/merge";
import { THEMES, type BrochurePage, type BrochureSize, type BrochureTheme } from "./types";

const NAVY = "#0c2340";
const INK = "#1e2a3a";
const MUTED = "#6a7690";
const BLEED = 9; // 0.125in
const MARGIN = 54; // 0.75in

const TRIM: Record<BrochureSize, [number, number]> = {
  letter: [612, 792],
  a4: [595.28, 841.89],
  square: [576, 576],
};

const DEFAULT_TEAM_BODY = "Hosted and produced by the iCFO Capital Global events team. Master of ceremonies and coordinators are introduced on stage.";

const DISCLAIMERS = [
  "This booklet is provided for education and community purposes only.",
  "Nothing in this booklet is an offer to sell or a solicitation of an offer to buy any security, nor a recommendation of any security or investment strategy.",
  "iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser. No funding outcome is promised or implied.",
  "Presenting companies and sponsors are responsible for their own statements. Participation does not constitute an endorsement.",
  "Prospective investors should consult their own legal, tax, and financial advisers before making any investment decision.",
];

/** Render the booklet to a PDF Buffer. */
export function renderBrochurePdf(
  merge: EventMergeData,
  pages: BrochurePage[],
  overrides: Record<string, Record<string, string>>,
  size: BrochureSize,
  opts: { bleed?: boolean; qr?: Buffer; theme?: BrochureTheme } = {},
): Promise<Buffer> {
  const theme = THEMES[opts.theme ?? "navy"];
  const primary = theme.primary;
  const bleed = opts.bleed ? BLEED : 0;
  const [tw, th] = TRIM[size];
  const pw = tw + bleed * 2;
  const ph = th + bleed * 2;
  const ox = bleed; // content origin x (trim edge)
  const oy = bleed;
  const contentW = tw - MARGIN * 2;

  const doc = new PDFDocument({ size: [pw, ph], margin: 0, info: { Title: merge.title } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const ov = (key: string, field: string, fallback: string) => overrides?.[key]?.[field] ?? fallback;
  const included = pages.filter((p) => p.included);

  // pre-compute contents numbering
  const toc: { n: number; label: string }[] = [];
  included.forEach((p, i) => {
    if (["cover", "disclaimers", "contents"].includes(p.type)) return;
    toc.push({ n: i + 1, label: pageLabel(p, overrides) });
  });

  let first = true;
  let pageNo = 0;
  const newPage = () => { if (!first) doc.addPage({ size: [pw, ph], margin: 0 }); first = false; pageNo += 1; };
  const cropMarks = () => {
    if (!bleed) return;
    doc.lineWidth(0.5).strokeColor("#000");
    const m = 6, o = bleed;
    // four corners
    const marks: [number, number, number, number][] = [
      [o - m, o, o, o], [o, o - m, o, o],
      [pw - o, o, pw - o + m, o], [pw - o, o - m, pw - o, o],
      [o - m, ph - o, o, ph - o], [o, ph - o, o, ph - o + m],
      [pw - o, ph - o, pw - o + m, ph - o], [pw - o, ph - o, pw - o, ph - o + m],
    ];
    marks.forEach(([x1, y1, x2, y2]) => doc.moveTo(x1, y1).lineTo(x2, y2).stroke());
  };
  const footer = () => {
    doc.fontSize(8).fillColor(MUTED).font("Helvetica");
    const y = oy + th - 30;
    doc.text("iCapOS · Powered by iCFO Capital Global, Inc.", ox + MARGIN, y, { width: contentW, align: "left" });
    doc.text(String(pageNo), ox + MARGIN, y, { width: contentW, align: "right" });
    doc.moveTo(ox + MARGIN, y - 6).lineTo(ox + tw - MARGIN, y - 6).lineWidth(0.5).strokeColor("#e2e8f2").stroke();
  };
  const heading = (text: string) => {
    doc.fillColor(primary).font("Helvetica-Bold").fontSize(20).text(text, ox + MARGIN, oy + MARGIN, { width: contentW });
    const y = doc.y + 4;
    doc.moveTo(ox + MARGIN, y).lineTo(ox + tw - MARGIN, y).lineWidth(1.5).strokeColor(primary).stroke();
    doc.moveDown(0.8);
  };

  const drawBlocks = (list: NonNullable<BrochurePage["blocks"]>) => {
    for (const b of list) {
      const bx = ox + b.x;
      const by = oy + b.y;
      if (b.type === "divider") { doc.save().rect(bx, by, b.w, Math.max(b.h, 1)).fill(b.color ?? NAVY).restore(); continue; }
      if (b.type === "image") {
        if (b.imageUrl && /^data:image\//.test(b.imageUrl)) {
          try { doc.image(Buffer.from(b.imageUrl.split(",")[1] ?? "", "base64"), bx, by, { width: b.w, height: b.h }); } catch { /* ignore */ }
        } else { doc.save().rect(bx, by, b.w, b.h).fill("#eef2f8").restore(); }
        continue;
      }
      const fs = b.fontSize ?? (b.type === "heading" ? 22 : 13);
      const color = b.color ?? (b.type === "heading" ? NAVY : INK);
      const font = b.type === "heading" ? "Helvetica-Bold" : "Helvetica";
      let tx = bx, ty = by, tw2 = b.w;
      if (b.type === "callout") { doc.save().roundedRect(bx, by, b.w, b.h, 6).fill(b.bg ?? "#f2f6fc").restore(); tx = bx + 10; ty = by + 10; tw2 = b.w - 20; }
      doc.font(font).fontSize(fs).fillColor(color).text(b.text ?? "", tx, ty, { width: tw2, align: b.align ?? "left" });
    }
  };

  for (const p of included) {
    newPage();
    cropMarks();
    switch (p.type) {
      case "cover": {
        if (p.blocks?.length) { drawBlocks(p.blocks); break; } // customized layout, no footer
        doc.rect(ox, oy, tw, th).fill(primary);
        doc.fillColor(theme.coverBadge).font("Helvetica-Bold").fontSize(11).text(merge.badge.toUpperCase(), ox + MARGIN, oy + th - 220, { width: contentW, characterSpacing: 1.5 });
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(34).text(ov("cover", "title", merge.title), ox + MARGIN, doc.y + 6, { width: contentW });
        if (merge.tagline) doc.fillColor("#d7e4f5").font("Helvetica").fontSize(14).text(ov("cover", "tagline", merge.tagline), ox + MARGIN, doc.y + 8, { width: contentW });
        doc.fillColor("#eaf1fb").font("Helvetica-Bold").fontSize(13).text(`${merge.dateLabel}${merge.timeRange ? ` · ${merge.timeRange}` : ""}`, ox + MARGIN, doc.y + 14, { width: contentW });
        break; // no footer on cover
      }
      case "disclaimers": {
        heading(ov("disclaimers", "heading", "Disclaimers & Important Notices"));
        doc.font("Helvetica").fontSize(10.5).fillColor("#4a5568");
        const dbody = overrides?.disclaimers?.body;
        if (dbody) { doc.text(dbody, ox + MARGIN, doc.y, { width: contentW }); }
        else { DISCLAIMERS.forEach((d) => { doc.text(d, ox + MARGIN, doc.y, { width: contentW }); doc.moveDown(0.6); }); }
        footer();
        break;
      }
      case "contents": {
        heading(ov("contents", "heading", "Contents"));
        doc.font("Helvetica").fontSize(12).fillColor(INK);
        toc.forEach((i) => {
          const y = doc.y;
          doc.text(i.label, ox + MARGIN, y, { width: contentW - 30 });
          doc.text(String(i.n), ox + MARGIN, y, { width: contentW, align: "right" });
          doc.moveDown(0.5);
        });
        footer();
        break;
      }
      case "introduction": {
        heading(ov("introduction", "heading", "Introduction"));
        doc.font("Helvetica").fontSize(12).fillColor(INK);
        doc.text(ov("introduction", "body", merge.tagline || "Welcome to the iCFO event."), ox + MARGIN, doc.y, { width: contentW });
        doc.moveDown(0.6);
        doc.text(ov("introduction", "audience", "Attendees include accredited investors, family offices, venture capitalists, and investment professionals across multiple industries."), { width: contentW });
        footer();
        break;
      }
      case "agenda": {
        heading(ov("agenda", "heading", "Agenda"));
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`${merge.dateLabel}${merge.timeRange ? ` · ${merge.timeRange}` : ""}`, { width: contentW });
        doc.moveDown(0.6);
        if (overrides?.agenda?.intro) { doc.font("Helvetica").fontSize(11).fillColor(INK).text(overrides.agenda.intro, ox + MARGIN, doc.y, { width: contentW }); doc.moveDown(0.6); }
        if (merge.sessions.length) {
          merge.sessions.forEach((s) => {
            doc.font("Helvetica-Bold").fontSize(9).fillColor(s.accent).text(s.type.replace(/_/g, " ").toUpperCase(), ox + MARGIN, doc.y, { width: contentW });
            doc.font("Helvetica-Bold").fontSize(13).fillColor(primary).text(s.title, { width: contentW });
            if (s.abstract) doc.font("Helvetica").fontSize(10.5).fillColor("#4a5568").text(s.abstract, { width: contentW });
            doc.moveDown(0.7);
          });
        } else {
          doc.font("Helvetica").fontSize(12).fillColor(INK).text("Agenda to be announced.", { width: contentW });
        }
        footer();
        break;
      }
      case "presenters": {
        const presHeading = ov("presenters", "heading", "Presenters");
        heading(presHeading);
        if (overrides?.presenters?.intro) { doc.font("Helvetica").fontSize(11).fillColor(INK).text(overrides.presenters.intro, ox + MARGIN, doc.y, { width: contentW }); doc.moveDown(0.6); }
        const colW = (contentW - 24) / 2;
        let col = 0;
        let rowY = doc.y;
        for (const pr of merge.presenters) {
          const x = ox + MARGIN + col * (colW + 24);
          // avatar circle
          doc.circle(x + 20, rowY + 20, 20).fill(primary);
          doc.fillColor("#fff").font("Helvetica-Bold").fontSize(13).text(pr.initials, x, rowY + 13, { width: 40, align: "center" });
          doc.fillColor(primary).font("Helvetica-Bold").fontSize(12).text(pr.name, x + 48, rowY + 6, { width: colW - 48 });
          if (pr.role) doc.fillColor("#4a5568").font("Helvetica").fontSize(10).text(pr.role, x + 48, doc.y, { width: colW - 48 });
          if (pr.company) doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(pr.company, x + 48, doc.y, { width: colW - 48 });
          col += 1;
          if (col === 2) { col = 0; rowY += 64; }
          if (rowY > oy + th - 90) { footer(); newPage(); cropMarks(); heading(`${presHeading} (cont.)`); rowY = doc.y; }
        }
        footer();
        break;
      }
      case "team": {
        heading(ov("team", "heading", "MC & Event Team"));
        doc.font("Helvetica").fontSize(12).fillColor(INK).text(ov("team", "body", DEFAULT_TEAM_BODY), ox + MARGIN, doc.y, { width: contentW });
        footer();
        break;
      }
      case "sponsors_contact": {
        heading(ov("sponsors_contact", "heading", "Sponsors"));
        if (overrides?.sponsors_contact?.intro) { doc.font("Helvetica").fontSize(11).fillColor(INK).text(overrides.sponsors_contact.intro, ox + MARGIN, doc.y, { width: contentW }); doc.moveDown(0.6); }
        const tier = (label: string, list: { name: string }[]) => {
          if (!list.length) return;
          doc.font("Helvetica-Bold").fontSize(11).fillColor(MUTED).text(label.toUpperCase(), ox + MARGIN, doc.y, { width: contentW, characterSpacing: 0.5 });
          doc.font("Helvetica-Bold").fontSize(13).fillColor(primary).text(list.map((s) => s.name).join("   ·   "), { width: contentW });
          doc.moveDown(0.6);
        };
        tier("Presenting partners", merge.sponsorTiers.presenting);
        tier("Track sponsors", merge.sponsorTiers.track);
        tier("Community", merge.sponsorTiers.community);
        if (![...merge.sponsorTiers.presenting, ...merge.sponsorTiers.track, ...merge.sponsorTiers.community].length) {
          doc.font("Helvetica").fontSize(12).fillColor(INK).text("Sponsor lineup to be announced.", { width: contentW });
        }
        doc.moveDown(1);
        doc.font("Helvetica-Bold").fontSize(20).fillColor(primary).text(ov("sponsors_contact", "contactHeading", "Contact"), ox + MARGIN, doc.y, { width: contentW });
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(12).fillColor(INK).text(ov("sponsors_contact", "contactBody", merge.organizerLine), { width: contentW });
        if (opts.qr) {
          const qs = 96;
          const qx = ox + tw - MARGIN - qs;
          const qy = oy + th - 130;
          try { doc.image(opts.qr, qx, qy, { width: qs, height: qs }); } catch { /* ignore bad image */ }
          doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("Scan for the digital booklet", qx - 20, qy + qs + 4, { width: qs + 40, align: "center" });
        }
        footer();
        break;
      }
      case "custom": {
        const c = p.custom;
        if (c?.heading) heading(c.heading); else doc.y = oy + MARGIN;
        if (c?.body) doc.font("Helvetica").fontSize(12).fillColor(INK).text(c.body, ox + MARGIN, doc.y, { width: contentW });
        footer();
        break;
      }
      case "freeform": {
        drawBlocks(p.blocks ?? []);
        footer();
        break;
      }
    }
  }

  doc.end();
  return done;
}

function pageLabel(p: BrochurePage, o?: Record<string, Record<string, string>>): string {
  if (p.type === "custom") return p.custom?.heading || "Custom page";
  const map: Record<string, string> = {
    introduction: "Introduction", agenda: "Agenda", presenters: "Presenters",
    team: "MC & Team", sponsors_contact: "Sponsors & Contact",
  };
  return o?.[p.type]?.heading || map[p.type] || p.type;
}
