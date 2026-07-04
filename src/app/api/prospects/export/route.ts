import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getContactsForExport } from "@/lib/prospects/store";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/prospects/export?side=&segment=&status=&search= — CSV of the filtered list.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const rows = await getContactsForExport({
    side: sp.get("side") || undefined,
    segment: sp.get("segment") || undefined,
    status: sp.get("status") || undefined,
    leadStatus: sp.get("leadStatus") || undefined,
    search: sp.get("search") || undefined,
  });

  const header = ["name", "email", "company", "side", "segment", "email_status", "lead_status", "lead_prescore", "source"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.email, r.company, r.side, r.segment, r.email_status, r.lead_status, r.lead_prescore, r.source].map(csvCell).join(","));
  }
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
