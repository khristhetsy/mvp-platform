import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { parseCsv } from "@/lib/investor-directory/clean";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20000;

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if (typeof o.text === "string") return o.text;
    if ("result" in o) return cellText(o.result as ExcelJS.CellValue);
    if (typeof o.hyperlink === "string") return o.hyperlink;
    return "";
  }
  return String(v);
}

/** Read an uploaded .xlsx or .csv into a header row and data rows. Nothing is saved. */
export async function POST(req: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 8 MB. Split it and import in parts." }, { status: 400 });
    const wanted = typeof form.get("sheet") === "string" ? String(form.get("sheet")) : "";
    const lower = file.name.toLowerCase();

    let sheets: { name: string; rows: number }[] = [{ name: "CSV", rows: 0 }];
    let grid: string[][];
    let sheet = "CSV";

    if (lower.endsWith(".xlsx")) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const all = wb.worksheets;
      if (!all.length) return NextResponse.json({ error: "The workbook has no sheets." }, { status: 400 });
      sheets = all.map((w) => ({ name: w.name, rows: Math.max(0, w.actualRowCount - 1) }));
      const ws = all.find((w) => w.name === wanted) ?? all.find((w) => w.actualRowCount > 1) ?? all[0];
      sheet = ws.name;
      const width = ws.actualColumnCount;
      grid = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value).replace(/\s+/g, " ").trim());
        grid.push(cells);
      });
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      grid = parseCsv(await file.text());
      sheets = [{ name: "CSV", rows: Math.max(0, grid.length - 1) }];
    } else {
      return NextResponse.json({ error: "Use an Excel (.xlsx) or CSV file." }, { status: 400 });
    }

    if (grid.length < 2) return NextResponse.json({ error: "The sheet needs a header row and at least one data row." }, { status: 400 });
    const headers = grid[0].map((h, i) => (h && h.trim()) || `Column ${i + 1}`);
    const rows = grid.slice(1).filter((r) => r.some((c) => c && c.trim()));
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `That sheet has more than ${MAX_ROWS.toLocaleString("en-US")} rows. Split it and import in parts.` }, { status: 400 });
    return NextResponse.json({ fileName: file.name, sheets, sheet, headers, rows });
  } catch (err) {
    return failed(err, "Could not read that file.");
  }
}
