import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSnapshot } from "@/lib/forecast/store";
import { getSalesScope } from "@/lib/sales/scope";
import { forecastOwnerId } from "@/lib/sales/forecast-scope";
import type { MonthSegmentRow } from "@/lib/forecast/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLUMNS: Array<{ key: keyof MonthSegmentRow; header: string }> = [
  { key: "month", header: "Month" },
  { key: "segment", header: "Segment" },
  { key: "leads", header: "Leads" },
  { key: "mql", header: "MQL" },
  { key: "sql", header: "SQL" },
  { key: "trials", header: "Trials" },
  { key: "new_subs", header: "New subs" },
  { key: "churned_subs", header: "Churned subs" },
  { key: "active_subs", header: "Active subs" },
  { key: "new_mrr", header: "New MRR (cents)" },
  { key: "expansion_mrr", header: "Expansion MRR (cents)" },
  { key: "contraction_mrr", header: "Contraction MRR (cents)" },
  { key: "churned_mrr", header: "Churned MRR (cents)" },
  { key: "ending_mrr", header: "Ending MRR (cents)" },
  { key: "arr", header: "ARR (cents)" },
];

function toCsv(rows: MonthSegmentRow[]): string {
  const head = COLUMNS.map((c) => c.header).join(",");
  const body = rows.map((r) => COLUMNS.map((c) => String(r[c.key] ?? "")).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

// GET /api/sales/forecast/export?snapshot=<id>&format=csv|xlsx
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const snapshotId = req.nextUrl.searchParams.get("snapshot");
  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (!snapshotId) return NextResponse.json({ error: "snapshot is required." }, { status: 400 });

  const scope = await getSalesScope(profile);
  const snap = await getSnapshot(snapshotId, forecastOwnerId(scope, profile.id, req.nextUrl.searchParams.get("scope")));
  if (!snap) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  const rows = snap.output.rows;
  const stamp = snap.meta.computed_at.slice(0, 10);

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="forecast-${stamp}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Forecast");
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: String(c.key), width: 16 }));
    for (const r of rows) ws.addRow(r);
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="forecast-${stamp}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "format must be csv or xlsx." }, { status: 400 });
}
