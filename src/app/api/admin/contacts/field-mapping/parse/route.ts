/**
 * POST multipart { file } → { columns, rows } for an Excel (.xlsx) contact import.
 * Staff only. Each cell is read as the text Excel shows (cell.text), so a phone number,
 * date or amount keeps the format it has in the sheet. First worksheet, first row = header.
 */
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/supabase/auth";
import { splitHeader } from "@/lib/contacts/field-mapping";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;

export async function POST(req: NextRequest): Promise<Response> {
  if (!(await requireRole(["admin", "analyst"]).catch(() => null))) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an .xlsx file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 10 MB." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Excel imports must be .xlsx files." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return NextResponse.json({ error: "Couldn't read that Excel file." }, { status: 400 }); }
  const ws = wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "That workbook has no sheets." }, { status: 400 });

  const width = ws.columnCount;
  const cells: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const r: string[] = [];
    for (let i = 1; i <= width; i++) r.push(row.getCell(i).text ?? "");
    if (r.some((c) => c.trim())) cells.push(r);
  });
  if (cells.length < 2) return NextResponse.json({ error: "No data rows found under the header row." }, { status: 400 });
  if (cells.length - 1 > MAX_ROWS) return NextResponse.json({ error: `Up to ${MAX_ROWS.toLocaleString()} rows per import.` }, { status: 400 });
  return NextResponse.json(splitHeader(cells));
}
