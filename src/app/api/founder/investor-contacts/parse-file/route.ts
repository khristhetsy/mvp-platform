/**
 * POST multipart { file } → { cells } for a founder's Excel (.xlsx) contact
 * import. CSV files are read in the browser; Excel needs exceljs, which is
 * server only. First worksheet; each cell as the text Excel shows. Nothing is
 * saved here: the import itself goes through /api/founder/investor-contacts/import.
 */
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an .xlsx file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 10 MB." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Excel files must be .xlsx." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Couldn't read that Excel file." }, { status: 400 });
  }
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
  return NextResponse.json({ cells });
}
