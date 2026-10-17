import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { parseCsv } from "@/lib/investor-directory/clean";
import { autoMatch } from "@/lib/investor-directory/import-mapping";

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

/** Non blank rows of a sheet as text, up to `limit` sheet rows. */
function readGrid(ws: ExcelJS.Worksheet, limit: number): string[][] {
  const width = ws.actualColumnCount;
  const out: string[][] = [];
  const last = Math.min(ws.rowCount, limit);
  for (let r = 1; r <= last; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value).replace(/\s+/g, " ").trim());
    if (cells.some(Boolean)) out.push(cells);
  }
  return out;
}

/** A sheet can be imported when its first row has a column that matches Firm. */
function importable(grid: string[][]): boolean {
  if (grid.length < 2) return false;
  const headers = grid[0].map((h, i) => h || `Column ${i + 1}`);
  const m = autoMatch(headers, grid.slice(1)).mapping;
  return Object.values(m).some((f) => f.includes("firm") || f.includes("fund_name"));
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

    let sheets: { name: string; rows: number; cols: number; importable: boolean }[];
    let grid: string[][];
    let sheet = "CSV";

    if (lower.endsWith(".xlsx")) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const all = wb.worksheets;
      if (!all.length) return NextResponse.json({ error: "The workbook has no sheets." }, { status: 400 });
      sheets = all.map((w) => {
        const peek = readGrid(w, 30);
        return { name: w.name, rows: Math.max(0, w.actualRowCount - 1), cols: peek[0]?.length ?? 0, importable: importable(peek) };
      });
      const pick = sheets.find((s) => s.name === wanted) ?? sheets.find((s) => s.importable) ?? sheets[0];
      sheet = pick.name;
      grid = readGrid(all.find((w) => w.name === sheet) ?? all[0], Number.MAX_SAFE_INTEGER);
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      grid = parseCsv(await file.text());
      sheets = [{ name: "CSV", rows: Math.max(0, grid.length - 1), cols: grid[0]?.length ?? 0, importable: true }];
    } else {
      return NextResponse.json({ error: "Use an Excel (.xlsx) or CSV file." }, { status: 400 });
    }

    if (grid.length < 2) return NextResponse.json({ error: "The sheet needs a header row and at least one data row." }, { status: 400 });
    if (grid.length - 1 > MAX_ROWS) return NextResponse.json({ error: `That sheet has more than ${MAX_ROWS.toLocaleString("en-US")} rows. Split it and import in parts.` }, { status: 400 });
    // The whole grid goes back so the screen can change which row holds the headers.
    return NextResponse.json({ fileName: file.name, sheets, sheet, grid });
  } catch (err) {
    return failed(err, "Could not read that file.");
  }
}
