// Renders a founder cap table to a formatted .xlsx workbook (server-only).
// Sheets: Summary (ownership by group), Holders (full list), Round model
// (dilution, only when a round is modeled). All math from the pure engine.

import ExcelJS from "exceljs";
import type { CapTable } from "./types";
import { summarize, modelRound } from "./compute";

const HEADER_FILL = "FF1E293B";
const HEADER_FONT = "FFFFFFFF";

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
  });
}

export async function renderCapTableWorkbook(companyName: string, cap: CapTable): Promise<Buffer> {
  const sum = summarize(cap.holders);
  const wb = new ExcelJS.Workbook();
  wb.creator = "iCapOS";
  wb.created = new Date();

  // ── Sheet 1: Summary ───────────────────────────────────────────────────
  const s = wb.addWorksheet("Summary", { properties: { defaultColWidth: 22 } });
  s.mergeCells("A1:C1");
  s.getCell("A1").value = `${companyName} — Cap table`;
  s.getCell("A1").font = { bold: true, size: 16 };
  s.addRow([]);
  const sh = s.addRow(["Group", "Ownership", "Shares"]);
  styleHeaderRow(sh);
  const groupShares = (g: "founder" | "pool" | "investor") =>
    cap.holders.filter((h) => h.group === g).reduce((t, h) => t + Math.max(0, h.shares), 0);
  ([
    ["Founders", sum.founderPct, groupShares("founder")],
    ["Option pool", sum.poolPct, groupShares("pool")],
    ["Investors", sum.investorPct, groupShares("investor")],
  ] as const).forEach(([label, pct, shares]) => {
    const r = s.addRow([label, pct, shares]);
    r.getCell(2).numFmt = "0.0%";
    r.getCell(3).numFmt = "#,##0";
  });
  const tot = s.addRow(["Fully diluted", 1, sum.totalShares]);
  tot.getCell(2).numFmt = "0.0%";
  tot.getCell(3).numFmt = "#,##0";
  tot.font = { bold: true };

  // ── Sheet 2: Holders ───────────────────────────────────────────────────
  const h = wb.addWorksheet("Holders", { properties: { defaultColWidth: 18 } });
  const hh = h.addRow(["Holder", "Group", "Share class", "Shares", "Fully diluted %"]);
  styleHeaderRow(hh);
  h.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of sum.rows) {
    const r = h.addRow([row.holder.name, row.holder.group, row.holder.shareClass, Math.max(0, row.holder.shares), row.pct]);
    r.getCell(4).numFmt = "#,##0";
    r.getCell(5).numFmt = "0.0%";
  }
  h.getColumn(1).width = 26;

  // ── Sheet 3: Round model (optional) ────────────────────────────────────
  if (cap.round && (cap.round.newInvestment > 0 || cap.round.preMoney > 0)) {
    const res = modelRound(cap.holders, cap.round);
    const r = wb.addWorksheet("Round model", { properties: { defaultColWidth: 20 } });
    const meta = r.addRow(["Metric", "Value"]);
    styleHeaderRow(meta);
    const m = (label: string, value: number, fmt: string) => {
      const row = r.addRow([label, value]);
      row.getCell(2).numFmt = fmt;
    };
    m("Pre-money", res.preMoney, "$#,##0");
    m("New investment", res.newInvestment, "$#,##0");
    m("Post-money", res.postMoney, "$#,##0");
    if (res.pricePerShare !== null) m("Price per share", res.pricePerShare, "$#,##0.0000");
    m("New shares issued", Math.round(res.newShares), "#,##0");
    m("New investor ownership", res.newInvestorPct, "0.0%");
    r.addRow([]);
    const dh = r.addRow(["Holder", "Before", "After"]);
    styleHeaderRow(dh);
    for (const d of res.rows) {
      const row = r.addRow([d.name, d.pctBefore, d.pctAfter]);
      row.getCell(2).numFmt = "0.0%";
      row.getCell(3).numFmt = "0.0%";
    }
    r.getColumn(1).width = 26;
  }

  // Disclaimer on the summary sheet.
  s.addRow([]);
  s.addRow(["Illustrative cap table prepared by the founder on iCapOS. Not a valuation, an offer of securities, or investment advice."]).getCell(1).font = {
    italic: true,
    size: 9,
    color: { argb: "FF94A3B8" },
  };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
