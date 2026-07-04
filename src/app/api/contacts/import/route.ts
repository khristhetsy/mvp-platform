import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { parseCsv, parseVcard, parseXlsx } from "@/lib/contacts/parse";
import { importParsedRows } from "@/lib/contacts/importFile";
import type { ImportSource, ParsedContact } from "@/lib/contacts/types";

export const dynamic = "force-dynamic";

// POST /api/contacts/import — multipart file upload (csv/xlsx/vcard) → crm_contacts.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    let rows: ParsedContact[] = [];
    let source: ImportSource;

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      rows = await parseXlsx(await file.arrayBuffer());
      source = "xlsx";
    } else if (name.endsWith(".vcf") || name.endsWith(".vcard")) {
      rows = parseVcard(await file.text());
      source = "vcard";
    } else if (name.endsWith(".csv")) {
      rows = parseCsv(await file.text());
      source = "csv";
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use CSV, XLSX, or vCard (.vcf)." }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows with a valid email found in the file." }, { status: 400 });
    }

    const result = await importParsedRows(rows, source);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
