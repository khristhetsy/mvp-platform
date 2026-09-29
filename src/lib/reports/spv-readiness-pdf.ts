// SPV Readiness report PDF (Reports page), v2 look on the shared report kit.
// Pure model from the spv_readiness payload; every figure is a stored value,
// a count, a sum or a ratio of stored values. Nothing is estimated.

import type { AdminReportPayload } from "@/lib/reports/admin-reports";
import type { Cell, Metric, Section, Takeaway, Tone } from "@/lib/diligence/report-model";
import { M, MONO, NAVY, SERIF, W, createCanvas, docToBuffer, masthead, newReportDoc, safe } from "@/lib/diligence/pdf-primitives";
import { describeFilters } from "@/lib/reports/portfolio-diligence-pdf";

type Row = Record<string, unknown>;

export const SPV_TABLE_LIMIT = 60;

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const sum = (rows: Row[], k: string) => rows.reduce((t, r) => t + n(r[k]), 0);
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v: unknown) => `${Math.round(n(v))}%`;
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const label = (v: unknown) => String(v ?? "").replace(/^spv_/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const REVIEW_TONE: Record<string, Tone> = { not_started: "neutral", approved_for_closing: "good", closed_operationally: "good" };
const STATUS_TONE: Record<string, Tone> = { closed: "good", open: "medium", draft: "neutral", canceled: "neutral" };
const pill = (v: unknown, map: Record<string, Tone>, fallback: Tone = "medium"): Cell => (v ? { pill: label(v), tone: map[String(v)] ?? fallback } : "—");

const isClosed = (r: Row) => r.closing_review_status === "closed_operationally" || r.spv_status === "closed";
const isApproved = (r: Row) => r.closing_review_status === "approved_for_closing" && !isClosed(r);

export type SpvModel = {
  generatedAt: Date;
  generatedBy: string;
  spvCount: number;
  filterLines: string[];
  metrics: Metric[];
  pipeline: NonNullable<Section["bar"]>;
  takeaways: Takeaway[];
  sections: Section[];
};

export function buildSpvModel(payload: AdminReportPayload, generatedBy: string): SpvModel {
  const rows = (payload.sections.spv_readiness_rows ?? []) as Row[];
  const notifications = (payload.sections.notification_type_totals ?? []) as Row[];
  const total = rows.length;
  const indicative = sum(rows, "indicative_participation_total");
  const target = sum(rows, "target_amount");
  const blocked = rows.filter((r) => n(r.pending_blocker_count) > 0);
  const blockerItems = sum(rows, "pending_blocker_count");
  const critical = rows.filter((r) => n(r.open_critical_compliance_count) > 0);
  const closed = rows.filter(isClosed).length;
  const approved = rows.filter(isApproved).length;
  const notStarted = rows.filter((r) => !isClosed(r) && !isApproved(r) && (r.closing_review_status ?? "not_started") === "not_started").length;
  const inReview = total - closed - approved - notStarted;

  const metrics: Metric[] = [
    { value: String(total), label: "SPVs" },
    { value: money(indicative), label: "Indicative participation" },
    { value: String(sum(rows, "investor_count")), label: "Participating investors" },
    { value: total ? pct(payload.summary.averageClosingReadinessPct) : "—", label: "Average closing readiness" },
    { value: String(blocked.length), label: "SPVs with open blockers", alert: blocked.length > 0 },
  ];

  const pipeline: NonNullable<Section["bar"]> = {
    segments: [
      { value: closed, label: "Closed", color: "#1E4E8C" },
      { value: approved, label: "Approved for closing", color: "#6F95C4" },
      { value: inReview, label: "In closing review", color: "#E0A33A" },
      { value: notStarted, label: "Review not started", color: "#B8C0CC" },
    ],
  };

  const t: Takeaway[] = [];
  if (total === 0) t.push({ title: "No SPVs match these filters.", body: "Widen the filters or clear them to see every SPV." });
  if (blocked.length) t.push({ title: `${plural(blocked.length, "SPV")} with open closing blockers.`, body: `${plural(blockerItems, "blocker")} in total, each listed by name in the next section.` });
  if (critical.length) t.push({ title: `${plural(critical.length, "SPV")} with open critical compliance events.`, body: "Critical compliance must be cleared before closing." });
  if (target > 0) t.push({ title: `Indicative participation covers ${Math.round((indicative / target) * 100)}% of combined targets.`, body: `${money(indicative)} indicated against ${money(target)} targeted across ${plural(total, "SPV")}.` });
  if (total > 0 && (approved || closed)) t.push({ title: `${approved} approved for closing, ${closed} closed.`, body: "See the closing pipeline above." });
  if (t.length === 0) t.push({ title: "No open issues across these SPVs.", body: "No blockers and no open critical compliance recorded." });

  const sections: Section[] = [];

  const attention = [...blocked].sort((a, b) => n(b.pending_blocker_count) - n(a.pending_blocker_count));
  sections.push({
    key: "blockers",
    title: "SPVs with open blockers",
    intro: "Closing criteria not yet met, as computed by the platform for each SPV.",
    empty: "No SPV has an open closing blocker.",
    table: attention.length
      ? {
          columns: [
            { label: "SPV", width: 0.22 },
            { label: "Company", width: 0.18 },
            { label: "Closing", width: 0.1, align: "right" },
            { label: "Open blockers", width: 0.5 },
          ],
          rows: attention.slice(0, SPV_TABLE_LIMIT).map((r) => [String(r.spv_name ?? "—"), String(r.company_name ?? "—"), pct(r.closing_readiness_pct), String(r.pending_blockers ?? "—").split("; ").join("\n")]),
        }
      : undefined,
  });

  const ordered = [...rows].sort((a, b) => n(b.pending_blocker_count) - n(a.pending_blocker_count) || n(a.closing_readiness_pct) - n(b.closing_readiness_pct));
  const shown = ordered.slice(0, SPV_TABLE_LIMIT);
  sections.push({
    key: "readiness",
    title: "Readiness by SPV",
    intro: `${total > SPV_TABLE_LIMIT ? `Showing ${SPV_TABLE_LIMIT} of ${total} SPVs. The CSV export has every row. ` : ""}Readiness percentages for the checklist, investor requirements, document package and closing criteria.`,
    empty: "No SPVs match these filters.",
    table: shown.length
      ? {
          columns: [
            { label: "SPV", width: 0.2 },
            { label: "Status", width: 0.11 },
            { label: "Checklist", width: 0.1, align: "right" },
            { label: "Investors", width: 0.1, align: "right" },
            { label: "Package", width: 0.1, align: "right" },
            { label: "Closing", width: 0.09, align: "right" },
            { label: "Closing review", width: 0.2 },
            { label: "Blockers", width: 0.1, align: "right" },
          ],
          rows: shown.map((r) => [
            `${String(r.spv_name ?? "—")}\n${String(r.company_name ?? "")}`.trim(),
            pill(r.spv_status, STATUS_TONE, "neutral"),
            pct(r.checklist_readiness_pct),
            pct(r.investor_requirement_readiness_pct),
            pct(r.document_package_readiness_pct),
            pct(r.closing_readiness_pct),
            pill(r.closing_review_status ?? "not_started", REVIEW_TONE),
            n(r.pending_blocker_count) > 0 ? ({ pill: String(n(r.pending_blocker_count)), tone: "high" } as Cell) : "0",
          ]),
        }
      : undefined,
  });

  sections.push({
    key: "participation",
    title: "Investor participation",
    metrics: [
      { value: money(indicative), label: "Indicated" },
      { value: money(target), label: "Combined targets" },
      { value: String(sum(rows, "investors_document_ready_count")), label: "Investors document ready" },
      { value: String(sum(rows, "investor_pending_requirements_count")), label: "Pending investor requirements", alert: sum(rows, "investor_pending_requirements_count") > 0 },
    ],
    table: shown.length
      ? {
          columns: [
            { label: "SPV", width: 0.28 },
            { label: "Investors", width: 0.11, align: "right" },
            { label: "Indicated", width: 0.16, align: "right" },
            { label: "Target", width: 0.16, align: "right" },
            { label: "Coverage", width: 0.11, align: "right" },
            { label: "Doc ready", width: 0.09, align: "right" },
            { label: "Pending", width: 0.09, align: "right" },
          ],
          rows: [...shown]
            .sort((a, b) => n(b.indicative_participation_total) - n(a.indicative_participation_total))
            .map((r) => [
              String(r.spv_name ?? "—"),
              String(n(r.investor_count)),
              money(n(r.indicative_participation_total)),
              n(r.target_amount) > 0 ? money(n(r.target_amount)) : "—",
              n(r.target_amount) > 0 ? `${Math.round((n(r.indicative_participation_total) / n(r.target_amount)) * 100)}%` : "—",
              String(n(r.investors_document_ready_count)),
              String(n(r.investor_pending_requirements_count)),
            ]),
        }
      : undefined,
  });

  sections.push({
    key: "compliance",
    title: "Compliance and activity",
    keyValues: [
      ["Compliance events on SPV companies", String(sum(rows, "compliance_events_count"))],
      ["Open critical compliance events", String(sum(rows, "open_critical_compliance_count"))],
      ["SPV notifications sent", String(notifications.reduce((t2, r) => t2 + n(r.count), 0))],
    ],
    table: notifications.length
      ? {
          columns: [
            { label: "Notification", width: 0.7 },
            { label: "Count", width: 0.3, align: "right" },
          ],
          rows: [...notifications].sort((a, b) => n(b.count) - n(a.count)).map((r) => [label(r.notification_type), String(n(r.count))]),
        }
      : undefined,
  });

  sections.push({
    key: "scope",
    title: "Scope and disclaimer",
    keyValues: [["Filters", describeFilters(payload.meta.filters).join("; ") || "None"]],
    paragraphs: [payload.meta.privacyNotice, "Prepared by iCFO Capital Global, Inc. for internal staff."],
  });

  const filters = describeFilters(payload.meta.filters);
  return {
    generatedAt: new Date(payload.meta.generatedAt),
    generatedBy,
    spvCount: total,
    filterLines: filters.length ? filters : ["All SPVs (no filters)"],
    metrics,
    pipeline,
    takeaways: t.slice(0, 3),
    sections,
  };
}

export async function buildSpvReadinessV2Pdf(payload: AdminReportPayload, context: { generatedBy: string }): Promise<Buffer> {
  const model = buildSpvModel(payload, context.generatedBy);
  const doc = newReportDoc("SPV Readiness Report");
  return docToBuffer(doc, () => {
    const c = createCanvas(doc);
    const stamp = model.generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC";

    masthead(c, {
      title: "SPV Readiness Report",
      subtitle: `${model.filterLines.join(" · ")} · Internal staff use only`,
      meta: [["SPVs", String(model.spvCount)], ["Generated", stamp], ["Prepared by", model.generatedBy]],
      titleSize: 22,
    });

    c.label("Key metrics", M, c.y);
    c.y += 14;
    c.tiles(model.metrics);

    c.label("Closing pipeline", M, c.y);
    c.y += 14;
    c.bar(model.pipeline);

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

    c.sections(model.sections, 1);
    c.finish({
      left: "iCapOS · SPV Readiness Report",
      right: stamp,
      footer: "iCFO Capital Global, Inc. · Confidential · Internal staff use only",
    });
  });
}
