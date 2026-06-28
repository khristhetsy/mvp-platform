// Renders a founder financial model to a formatted .xlsx workbook (server-only).
// Three sheets: Assumptions (editable drivers), Monthly model (36 mo), Annual
// summary. All figures come from the deterministic projection engine — no AI math.

import ExcelJS from "exceljs";
import type { ProjectionAssumptions, ProjectionResult } from "@/lib/business-plan/projections";
import { ASSUMPTION_DEFS } from "@/lib/business-plan/assumptions";
import type { MonthlyRow } from "./monthly";

export interface FinancialModelInput {
  companyName: string;
  currency?: string; // ISO code label only, e.g. "USD"
  assumptions: ProjectionAssumptions;
  projections: ProjectionResult;
  monthly: MonthlyRow[];
  source: "business-plan" | "fresh";
}

const HEADER_FILL = "FF1E293B"; // slate-800
const HEADER_FONT = "FFFFFFFF";
const ACCENT_FILL = "FFEEF2FF"; // indigo-50

function moneyFmt(): string {
  return '#,##0;[Red](#,##0)';
}

function assumptionDisplay(a: ProjectionAssumptions, key: keyof ProjectionAssumptions): { value: number; fmt: string } {
  const def = ASSUMPTION_DEFS.find((d) => d.key === key);
  const value = a[key];
  if (def?.unit === "percent") return { value: value / 100, fmt: "0.0%" };
  if (def?.unit === "currency" || def?.unit === "currency_month") return { value, fmt: moneyFmt() };
  return { value, fmt: "#,##0" };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.alignment = { vertical: "middle" };
  });
}

export async function renderFinancialModelWorkbook(input: FinancialModelInput): Promise<Buffer> {
  const { companyName, assumptions, projections, monthly, source } = input;
  const currency = input.currency || "USD";
  const wb = new ExcelJS.Workbook();
  wb.creator = "iCapOS";
  wb.created = new Date();

  // ── Sheet 1: Assumptions ───────────────────────────────────────────────
  const aSheet = wb.addWorksheet("Assumptions", { properties: { defaultColWidth: 22 } });
  aSheet.mergeCells("A1:C1");
  aSheet.getCell("A1").value = `${companyName} — Financial Model`;
  aSheet.getCell("A1").font = { bold: true, size: 16 };
  aSheet.getCell("A3").value = "Drivers";
  aSheet.getCell("A3").font = { bold: true, size: 12 };
  aSheet.getCell("C3").value = source === "business-plan" ? "Imported from AI Business Plan" : "Built in iCapOS";
  aSheet.getCell("C3").font = { italic: true, color: { argb: "FF6366F1" } };

  const aHeader = aSheet.addRow(["Driver", "Value", "Notes"]);
  styleHeaderRow(aHeader);
  for (const def of ASSUMPTION_DEFS) {
    const { value, fmt } = assumptionDisplay(assumptions, def.key);
    const row = aSheet.addRow([def.label, value, def.help]);
    row.getCell(2).numFmt = fmt;
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_FILL } };
    row.getCell(3).alignment = { wrapText: true };
  }
  aSheet.getColumn(1).width = 22;
  aSheet.getColumn(2).width = 16;
  aSheet.getColumn(3).width = 48;
  aSheet.addRow([]);
  aSheet.addRow([`Currency: ${currency}`]);
  aSheet.addRow([`Runway: ${projections.runwayMonths === null ? "Cash-flow positive within 36 months" : `${projections.runwayMonths} months to zero cash`}`]);
  aSheet.addRow([`Ending cash (month 36): ${projections.endingCash.toLocaleString()}`]);
  aSheet.addRow([]);
  aSheet.addRow(["Illustrative projection based on the drivers above. Not a forecast, guarantee, or investment advice."]).getCell(1).font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };

  // ── Sheet 2: Monthly model ─────────────────────────────────────────────
  const mSheet = wb.addWorksheet("Monthly model", { properties: { defaultColWidth: 14 } });
  const mHeader = mSheet.addRow(["Month", "Year", "Customers", "Revenue", "Gross profit", "Operating cost", "Net cash flow", "Cash balance"]);
  styleHeaderRow(mHeader);
  mSheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of monthly) {
    const row = mSheet.addRow([r.month, r.year, r.customers, r.revenue, r.grossProfit, r.operatingExpense, r.netCashFlow, r.cashBalance]);
    for (let c = 4; c <= 8; c++) row.getCell(c).numFmt = moneyFmt();
    if (r.cashBalance < 0) row.getCell(8).font = { color: { argb: "FFDC2626" }, bold: true };
  }
  mSheet.getColumn(1).width = 8;
  mSheet.getColumn(2).width = 8;

  // ── Sheet 3: Annual summary ────────────────────────────────────────────
  const ySheet = wb.addWorksheet("Annual summary", { properties: { defaultColWidth: 18 } });
  const yHeader = ySheet.addRow(["Metric", "Year 1", "Year 2", "Year 3"]);
  styleHeaderRow(yHeader);
  const metrics: Array<[string, (y: ProjectionResult["years"][number]) => number]> = [
    ["Revenue", (y) => y.revenue],
    ["Gross profit", (y) => y.grossProfit],
    ["Operating expense", (y) => y.operatingExpense],
    ["Net cash flow", (y) => y.netCashFlow],
  ];
  for (const [label, pick] of metrics) {
    const row = ySheet.addRow([label, ...projections.years.map(pick)]);
    for (let c = 2; c <= 4; c++) row.getCell(c).numFmt = moneyFmt();
    row.getCell(1).font = { bold: true };
  }
  ySheet.getColumn(1).width = 22;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
