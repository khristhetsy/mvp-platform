/**
 * New directory import.
 *   POST { name, source, sourceUrl?, fileName?, csv } → { import, cleaned: { rowCount, merged, invalidEmails, skipped } }
 * Cleaning runs on every import (dedupe, normalize, flag bad emails, map
 * labels to platform option lists). Rows land as drafts; publish them from
 * the Imports page once checked.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { cleanCsv } from "@/lib/investor-directory/clean";
import { createImport } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  name: z.string().min(1).max(200),
  source: z.string().min(1).max(200),
  sourceUrl: z.string().url().max(1000).nullable().optional().or(z.literal("").transform(() => null)),
  fileName: z.string().max(300).nullable().optional(),
  csv: z.string().min(1).max(15_000_000),
});

export async function POST(request: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a name, a source and a CSV file." }, { status: 400 });
  const cleaned = cleanCsv(parsed.data.csv);
  if (cleaned.rows.length === 0) return NextResponse.json({ error: "No usable rows. The file needs a firm or company column." }, { status: 400 });
  try {
    const imp = await createImport({
      name: parsed.data.name, source: parsed.data.source, sourceUrl: parsed.data.sourceUrl ?? null, fileName: parsed.data.fileName ?? null,
      rows: cleaned.rows, rowCount: cleaned.rowCount, mergedInFile: cleaned.merged, invalidEmails: cleaned.invalidEmails, adminId: auth.adminId,
    });
    return NextResponse.json({ import: imp, cleaned: { rowCount: cleaned.rowCount, merged: cleaned.merged, invalidEmails: cleaned.invalidEmails, skipped: cleaned.skipped } });
  } catch (err) {
    return failed(err, "Couldn't store the import.");
  }
}
