// iCFO diligence memo → PDF (§14). Server-only, uses pdfkit (already a repo dep).
// Role-aware input: pass the output of serializeReport(role). Claims/candor only
// appear for the admin payload (the serializer drops them for other roles).

import PDFDocument from "pdfkit";
import type { ReportPayload } from "./serialize";

const INK = "#0c1826";
const BRAND = "#234f86";
const MUTED = "#5d6b7e";

const sev = (s: unknown) => String(s ?? "").toUpperCase();

export async function renderDiligenceMemoPdf(payload: ReportPayload, role: "admin" | "founder" | "investor"): Promise<Buffer> {
  const eng = payload.engagement as Record<string, unknown>;
  const company = String(eng.company_name ?? "Company");
  const reportCode = String(eng.report_code ?? "");
  const asOf = new Date().toISOString().slice(0, 10);

  return await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ margin: 56, size: "LETTER", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const h1 = (t: string) => { doc.moveDown(0.8); doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND).text(t); doc.moveDown(0.3); doc.fillColor(INK); };
    const h2 = (t: string) => { doc.moveDown(0.5); doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text(t); doc.moveDown(0.2); };
    const body = (t: string) => doc.font("Times-Roman").fontSize(10.5).fillColor(INK).text(t, { align: "justify" });
    const small = (t: string) => doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(t);
    const bullet = (t: string) => doc.font("Times-Roman").fontSize(10).fillColor(INK).text(`•  ${t}`, { indent: 10 });

    // Masthead
    doc.font("Helvetica-Bold").fontSize(16).fillColor(BRAND).text("iCFO iCapOS");
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("The Capital Readiness Platform · iCFO Venture Group");
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(`Diligence Memorandum — ${company}`);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
      [reportCode, eng.round_label, eng.sector].filter(Boolean).join("  ·  ") || reportCode,
    );
    doc.moveDown(0.4);
    doc.strokeColor("#d7dde5").moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();

    // Verdict (only present in admin/investor-when-gated payloads)
    if (eng.posture || eng.recommendation) {
      h1("Verdict");
      if (eng.posture) { h2("Posture"); body(String(eng.posture)); }
      if (eng.recommendation) { h2("Recommendation"); body(String(eng.recommendation)); }
    }
    h1("Confidence");
    body(`Verification confidence: ${Math.round(Number(eng.confidence_pct ?? payload.confidence ?? 0))}%.`);

    // Domains
    if (payload.domains.length) {
      h1("Domain assessment");
      for (const d of payload.domains as Record<string, unknown>[]) {
        h2(`${d.code ?? ""} — ${d.name ?? ""}${d.risk_rating ? `  (${sev(d.risk_rating)} risk)` : ""}`);
        if (d.overview) body(String(d.overview));
        const strengths = Array.isArray(d.strengths) ? (d.strengths as unknown[]) : [];
        const mitigation = Array.isArray(d.mitigation) ? (d.mitigation as unknown[]) : [];
        if (strengths.length) { small("Strengths"); strengths.forEach((s) => bullet(String(s))); }
        if (mitigation.length) { small("Mitigation"); mitigation.forEach((s) => bullet(String(s))); }
        if (d.conclusion) { small("Conclusion"); body(String(d.conclusion)); }
      }
    }

    // Appendix A — Findings register
    h1("Appendix A · Findings register");
    if (payload.findings.length === 0) small("No findings disclosed.");
    for (const f of payload.findings as Record<string, unknown>[]) {
      h2(`${f.finding_code ?? ""} · ${f.title ?? ""}`);
      small(`Severity ${sev(f.severity)} · Status ${String(f.status ?? "")} · ${String(f.verification ?? "")}`);
      if (f.detail) body(String(f.detail));
      if (role === "admin" && f.internal_note) { doc.font("Helvetica-Oblique").fontSize(9).fillColor("#b06a00").text(`Internal note: ${String(f.internal_note)}`); doc.fillColor(INK); }
    }

    // Appendix B — Verification ledger (admin only; claims absent otherwise)
    if (payload.claims && payload.claims.length) {
      h1("Appendix B · Verification ledger");
      for (const c of payload.claims as Record<string, unknown>[]) {
        bullet(`${c.claim ?? ""}${c.claimed_value ? ` — ${c.claimed_value}` : ""}  [${String(c.verification ?? "")}]`);
      }
    }

    // Appendix C — Conditions
    if (payload.conditions.length) {
      h1("Appendix C · Conditions");
      for (const c of payload.conditions as Record<string, unknown>[]) bullet(`${c.label ?? ""}  [${String(c.status ?? "")}]`);
    }

    // Appendix D — Founder response & rebuttal
    if (payload.responses.length) {
      h1("Appendix D · Founder response & rebuttal");
      for (const r of payload.responses as Record<string, unknown>[]) {
        h2(`${Array.isArray(r.finding_codes) ? (r.finding_codes as string[]).join(", ") : ""} · ${String(r.disposition ?? "")}`);
        body(String(r.body ?? ""));
        if (role === "admin" && r.icfo_review) small(`iCFO review: ${String(r.icfo_review)}`);
      }
    }

    // Appendix E — Data-room request list
    if (payload.docRequests.length) {
      h1("Appendix E · Data-room request list");
      for (const d of payload.docRequests as Record<string, unknown>[]) {
        bullet(`${d.label ?? ""}  [${String(d.status ?? "")}]${Array.isArray(d.closes_findings) && (d.closes_findings as string[]).length ? ` → ${(d.closes_findings as string[]).join(", ")}` : ""}`);
      }
    }

    // Appendix F — Consent & sign-off
    h1("Appendix F · Consent & sign-off");
    small("Consent is captured via the iCFO iCapOS in-platform e-signature. Sealed versions are hash-anchored and immutable.");

    // Running header/footer on every page.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const top = doc.page.margins.top - 28;
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(`Re: Diligence — ${company}   ·   As of ${asOf}`, left, top, { width, align: "left" });
      const bottom = doc.page.height - doc.page.margins.bottom + 14;
      doc.text(`iCFO iCapOS · Confidential${role !== "admin" ? " · Recipient cut" : ""}`, left, bottom, { width, align: "left" });
      doc.text(`Page ${i + 1} of ${range.count}`, left, bottom, { width, align: "right" });
    }

    doc.end();
  });
}
