// Portfolio Due Diligence report (Reports page, no single company selected), v2 look.
// Pure model from the admin due_diligence payload, drawn with the shared report kit.
// Every figure is a count or sum of stored values; nothing is estimated.

import type { AdminReportFilters, AdminReportPayload } from "@/lib/reports/admin-reports";
import type { Cell, Metric, Section, Takeaway } from "@/lib/diligence/report-model";
import { HEAD_INK, M, MONO, NAVY, PAGE_W, SERIF, W, createCanvas, docToBuffer, newReportDoc, safe } from "@/lib/diligence/pdf-primitives";

type Row = Record<string, unknown>;

export const PORTFOLIO_TABLE_LIMIT = 60;

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const sum = (rows: Row[], k: string) => rows.reduce((t, r) => t + n(r[k]), 0);
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

export type PortfolioModel = {
  generatedAt: Date;
  generatedBy: string;
  companyCount: number;
  filterLines: string[];
  metrics: Metric[];
  readinessBar: NonNullable<Section["bar"]>;
  takeaways: Takeaway[];
  sections: Section[];
};

export function describeFilters(f: AdminReportFilters): string[] {
  const out: string[] = [];
  if (f.dateFrom || f.dateTo) out.push(`Dates ${f.dateFrom ?? "start"} to ${f.dateTo ?? "today"}`);
  if (f.founderId) out.push(`Founder ${f.founderId}`);
  if (f.investorId) out.push(`Investor ${f.investorId}`);
  if (f.severity) out.push(`Compliance severity ${f.severity}`);
  if (f.reviewStatus) out.push(`Review status ${f.reviewStatus}`);
  return out.length ? out : ["All companies (no filters)"];
}

function readinessCell(score: unknown): Cell {
  if (score == null || score === "") return { pill: "Not scored", tone: "neutral" };
  const s = n(score);
  return { pill: String(Math.round(s)), tone: s >= 70 ? "good" : s >= 50 ? "medium" : "high" };
}

export function buildPortfolioModel(payload: AdminReportPayload, generatedBy: string): PortfolioModel {
  const companies = (payload.sections.company_diligence ?? []) as Row[];
  const topRisk = (payload.sections.top_risk_companies ?? []) as Row[];
  const dist = new Map(((payload.sections.readiness_distribution ?? []) as Row[]).map((r) => [String(r.bucket), n(r.count)]));
  const total = companies.length;
  const avg = payload.summary.averageReadinessScore;
  const unscored = dist.get("unknown") ?? companies.filter((c) => c.latest_readiness_score == null).length;
  const withCompliance = companies.filter((c) => n(c.open_compliance_events) > 0).length;
  const noDeck = companies.filter((c) => !c.pitch_deck_present).length;
  const interests = sum(companies, "expressed_interest_count");
  const remDone = sum(companies, "remediation_completed");
  const remOpen = sum(companies, "remediation_open");
  const remHigh = sum(companies, "remediation_high_priority_open");
  const docs = sum(companies, "document_count");
  const approved = sum(companies, "documents_approved_count");
  const withMissing = companies.filter((c) => String(c.missing_required_documents ?? "").trim() !== "").length;

  const metrics: Metric[] = [
    { value: String(total), label: "Companies" },
    { value: avg == null || avg === "" ? "—" : String(avg), label: "Average readiness" },
    { value: String(unscored), label: "Not yet scored", alert: unscored > 0 },
    { value: String(withCompliance), label: "With open compliance", alert: withCompliance > 0 },
    { value: String(interests), label: "Investor interests" },
  ];

  const readinessBar: NonNullable<Section["bar"]> = {
    segments: [
      { value: dist.get("90+") ?? 0, label: "90+", color: "#1E4E8C" },
      { value: dist.get("70-89") ?? 0, label: "70-89", color: "#6F95C4" },
      { value: dist.get("50-69") ?? 0, label: "50-69", color: "#E0A33A" },
      { value: dist.get("0-49") ?? 0, label: "0-49", color: "#9A3412" },
      { value: unscored, label: "Not scored", color: "#B8C0CC" },
    ],
  };

  const t: Takeaway[] = [];
  if (total === 0) t.push({ title: "No companies match these filters.", body: "Widen the filters or clear them to see the full portfolio." });
  if (unscored > 0) t.push({ title: `${unscored} of ${total} companies are not yet scored.`, body: "They cannot be benchmarked or matched to investors until their readiness assessment is complete." });
  if (remHigh > 0) t.push({ title: `${plural(remHigh, "high priority remediation task")} open.`, body: `${remDone} of ${remDone + remOpen} remediation tasks are complete across the portfolio.` });
  if (withCompliance > 0) t.push({ title: `${plural(withCompliance, "company", "companies")} with open compliance events.`, body: "Listed first in the company table." });
  if (noDeck > 0) t.push({ title: `${plural(noDeck, "company", "companies")} without a pitch deck.`, body: "A deck is required before investor introduction." });
  if (total > 0 && interests === 0) t.push({ title: "No investor interest recorded yet.", body: "0 expressed interests across all companies in this report." });
  if (t.length === 0) t.push({ title: "No open issues across the portfolio.", body: "Every company is scored, compliant and has a pitch deck on file." });

  const sections: Section[] = [];

  sections.push({
    key: "risk",
    title: "Highest risk companies",
    intro: "Ranked by the platform risk score, which combines readiness, open compliance and open high priority remediation.",
    empty: "No companies to rank.",
    table: topRisk.length
      ? {
          columns: [
            { label: "Company", width: 0.36 },
            { label: "Risk", width: 0.1, align: "right" },
            { label: "Readiness", width: 0.16 },
            { label: "Open compliance", width: 0.19, align: "right" },
            { label: "High priority open", width: 0.19, align: "right" },
          ],
          rows: topRisk.map((r) => [String(r.company_name ?? "—"), String(n(r.risk_score)), readinessCell(r.latest_readiness_score), String(n(r.open_compliance_events)), String(n(r.remediation_high_priority_open))]),
        }
      : undefined,
  });

  sections.push({
    key: "docs",
    title: "Documents",
    metrics: [
      { value: String(docs), label: "Documents on file" },
      { value: `${total - noDeck}/${total}`, label: "Companies with a pitch deck", alert: noDeck > 0 },
      { value: String(approved), label: "Approved by iCFO", alert: docs > 0 && approved === 0 },
      { value: String(withMissing), label: "Missing required documents", alert: withMissing > 0 },
    ],
    paragraphs: docs > 0 && approved === 0 ? ["None of the documents on file has an approved record yet. Approval is the step that turns a filed document into verified evidence."] : undefined,
  });

  sections.push({
    key: "remediation",
    title: "Remediation",
    bar: {
      segments: [
        { value: remDone, label: "Completed", color: "#1E4E8C" },
        { value: remHigh, label: "Open, high priority", color: "#9A3412" },
        { value: Math.max(0, remOpen - remHigh), label: "Open, other", color: "#E0A33A" },
      ],
      caption: remDone + remOpen > 0 ? `${remDone} of ${remDone + remOpen} tasks complete (${Math.round((remDone / (remDone + remOpen)) * 100)}%)` : "No remediation tasks recorded",
    },
  });

  sections.push({
    key: "activity",
    title: "Investor activity and compliance",
    metrics: [
      { value: String(interests), label: "Expressed interests" },
      { value: money(sum(companies, "indicative_pledge_total")), label: "Indicative pledges" },
      { value: String(sum(companies, "intro_request_count")), label: "Intro requests" },
      { value: String(sum(companies, "message_thread_count")), label: "Message threads" },
      { value: String(sum(companies, "meetings_scheduled_count")), label: "Meetings scheduled" },
      { value: String(sum(companies, "learning_modules_completed")), label: "Learning modules" },
    ],
    keyValues: [
      ["Open compliance events", String(sum(companies, "open_compliance_events"))],
      ["Flagged outreach, social, messages", String(sum(companies, "flagged_outreach_social_message_indicators"))],
    ],
  });

  // Company table: compliance issues first, then highest risk.
  const ordered = [...companies].sort((a, b) => n(b.open_compliance_events) - n(a.open_compliance_events) || n(b.risk_score) - n(a.risk_score));
  const shown = ordered.slice(0, PORTFOLIO_TABLE_LIMIT);
  sections.push({
    key: "companies",
    title: "Company table",
    intro: total > PORTFOLIO_TABLE_LIMIT ? `Showing ${PORTFOLIO_TABLE_LIMIT} of ${total} companies, compliance issues first, then highest risk. The CSV export has every row.` : "Compliance issues first, then highest risk.",
    empty: "No companies match these filters.",
    table: shown.length
      ? {
          columns: [
            { label: "Company", width: 0.25 },
            { label: "Readiness", width: 0.13 },
            { label: "Onboard", width: 0.09, align: "right" },
            { label: "Docs", width: 0.07, align: "right" },
            { label: "Deck", width: 0.07, align: "center" },
            { label: "Rem. open", width: 0.1, align: "right" },
            { label: "Compliance", width: 0.11, align: "right" },
            { label: "Interest", width: 0.08, align: "right" },
            { label: "Pledge", width: 0.1, align: "right" },
          ],
          rows: shown.map((c) => [
            String(c.company_name ?? "—"),
            readinessCell(c.latest_readiness_score),
            `${n(c.onboarding_progress_percent)}%`,
            String(n(c.document_count)),
            c.pitch_deck_present ? "Yes" : "No",
            n(c.remediation_high_priority_open) > 0 ? `${n(c.remediation_open)} (${n(c.remediation_high_priority_open)} high)` : String(n(c.remediation_open)),
            n(c.open_compliance_events) > 0 ? ({ pill: String(n(c.open_compliance_events)), tone: "high" } as Cell) : "0",
            String(n(c.expressed_interest_count)),
            money(n(c.indicative_pledge_total)),
          ]),
        }
      : undefined,
  });

  sections.push({
    key: "method",
    title: "Scope and privacy",
    keyValues: [["Filters", describeFilters(payload.meta.filters).join("; ")]],
    paragraphs: [
      `${payload.meta.privacyNotice} This PDF leaves out investor contact details, message bodies, OAuth tokens and calendar event identifiers.`,
      "Prepared by iCFO Capital Global, Inc. for internal staff. This report is not investment advice and is not an offer to sell or a solicitation to buy any security.",
    ],
  });

  return {
    generatedAt: new Date(payload.meta.generatedAt),
    generatedBy,
    companyCount: total,
    filterLines: describeFilters(payload.meta.filters),
    metrics,
    readinessBar,
    takeaways: t.slice(0, 3),
    sections,
  };
}

export async function buildDueDiligencePortfolioPdf(payload: AdminReportPayload, context: { generatedBy: string }): Promise<Buffer> {
  const model = buildPortfolioModel(payload, context.generatedBy);
  const doc = newReportDoc("Due Diligence Portfolio Report");
  return docToBuffer(doc, () => {
    const c = createCanvas(doc);
    const stamp = model.generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC";

    // Masthead
    const bandH = 112;
    doc.rect(0, 0, PAGE_W, bandH).fill(NAVY);
    c.text("iCapOS", M, 28, { font: "Times-Roman", size: 11, color: HEAD_INK, lineGap: 0 });
    c.text("Due Diligence Portfolio Report", M, 42, { font: SERIF, size: 22, color: "#FFFFFF", width: 330, lineGap: 0 });
    c.text(`${model.filterLines.join(" · ")} · Internal staff use only`, M, 76, { size: 10, color: HEAD_INK, width: 320, lineGap: 0 });
    const meta: [string, string][] = [
      ["Companies", String(model.companyCount)],
      ["Generated", stamp],
      ["Prepared by", model.generatedBy],
    ];
    meta.forEach(([k, v], i) => {
      c.text(k, PAGE_W - M - 200, 40 + i * 13, { size: 8, color: HEAD_INK, width: 70, lineGap: 0 });
      c.text(v, PAGE_W - M - 128, 40 + i * 13, { size: 8, color: "#FFFFFF", width: 128, lineGap: 0 });
    });
    c.y = bandH + 22;

    c.label("Key metrics", M, c.y);
    c.y += 14;
    c.tiles(model.metrics);

    c.label("Readiness distribution", M, c.y);
    c.y += 14;
    c.bar(model.readinessBar);

    c.text("What the reader needs to know", M, c.y, { font: SERIF, size: 14, color: NAVY, lineGap: 0 });
    c.y += 22;
    model.takeaways.forEach((t, i) => {
      const h = c.height(`${t.title} ${t.body}`, W - 24, "Helvetica-Bold", 9.5, 2);
      c.ensure(h + 6);
      c.text(String(i + 1).padStart(2, "0"), M, c.y, { font: MONO, size: 9, color: "#2F5D8A", lineGap: 0 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#1A1F2B").text(safe(t.title) + " ", M + 24, c.y, { width: W - 24, continued: true, lineGap: 2 });
      doc.font("Helvetica").text(safe(t.body), { lineGap: 2 });
      c.y += h + 6;
    });
    c.y += 12;

    // The highest risk table fits on page 1 when short; everything else flows after it.
    c.sections(model.sections, 1);
    c.finish({
      left: "iCapOS · Due Diligence Portfolio Report",
      right: stamp,
      footer: "iCFO Capital Global, Inc. · Confidential · Internal staff use only",
    });
  });
}
