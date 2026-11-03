import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const q = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Staff download of one founder upload: the original rows with every column the file had. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const { data } = await admin
    .from("founder_import_uploads")
    .select("file_name, columns, raw_rows")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Upload not found." }, { status: 404 });

  const columns = (data.columns ?? []) as string[];
  const rows = (data.raw_rows ?? []) as string[][];
  const csv = [columns.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join("\n");
  const base = String(data.file_name).replace(/[^\w.-]+/g, "_").replace(/\.[a-z]+$/i, "");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}-original.csv"`,
    },
  });
}
