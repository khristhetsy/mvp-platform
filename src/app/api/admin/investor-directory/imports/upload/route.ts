import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { createImport } from "@/lib/investor-directory/db";
import { applyMapping } from "@/lib/investor-directory/import-mapping";

export const runtime = "nodejs";

const FIELD = z.enum([
  "firm", "contact_name", "title", "email", "phone", "website", "location", "city", "state", "country",
  "investor_types", "funding_stages", "capital_types", "industries", "fund_name", "fund_size", "avg_investment",
  "strategy", "investing_now", "notes", "source_url",
]);

const body = z.object({
  name: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(200).default("Internet search"),
  sourceUrl: z.string().trim().max(2000).nullish(),
  fileName: z.string().trim().max(300).nullish(),
  headers: z.array(z.string()).min(1).max(200),
  rows: z.array(z.array(z.string())).min(1).max(20000),
  mapping: z.record(z.string(), z.array(FIELD)),
  valueMap: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
});

/** Apply the confirmed column mapping, then hand the clean rows to the existing import. */
export async function POST(req: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  try {
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "That import is missing something. Check the name and the column choices." }, { status: 400 });
    const b = parsed.data;
    const cleaned = applyMapping(b.headers, b.rows, b.mapping, b.valueMap ?? {});
    if (cleaned.missingFirm) return NextResponse.json({ error: "Choose a column for Firm before importing." }, { status: 400 });
    if (!cleaned.rows.length) return NextResponse.json({ error: "No rows had a firm name, so nothing was imported." }, { status: 400 });
    const imp = await createImport({
      name: b.name,
      source: b.source,
      sourceUrl: b.sourceUrl || null,
      fileName: b.fileName ?? null,
      rows: cleaned.rows,
      rowCount: cleaned.rowCount,
      mergedInFile: cleaned.merged,
      invalidEmails: cleaned.invalidEmails,
      adminId: auth.adminId,
    });
    return NextResponse.json({ import: imp, skipped: cleaned.skipped });
  } catch (err) {
    return failed(err, "Could not import that file.");
  }
}
