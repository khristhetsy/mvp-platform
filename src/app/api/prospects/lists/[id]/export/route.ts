import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/supabase/auth";
import { getListExportRows } from "@/lib/prospects/saved-lists";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/prospects/lists/[id]/export?format=csv|xlsx&cols=name,email,... — download a saved list.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const cols = (sp.get("cols") ?? "").split(",").map((c) => c.trim()).filter(Boolean);

  let result;
  try {
    result = await getListExportRows(id, cols);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed." }, { status: 500 });
  }

  const safe = result.listName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "list";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Contacts");
    ws.columns = result.columns.map((c) => ({ header: c, key: c, width: 22 }));
    ws.getRow(1).font = { bold: true };
    for (const r of result.rows) ws.addRow(r);
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safe}-${stamp}.xlsx"`,
      },
    });
  }

  const lines = [result.columns.join(",")];
  for (const r of result.rows) lines.push(result.columns.map((c) => csvCell(r[c])).join(","));
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}-${stamp}.csv"`,
    },
  });
}
