import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isFeatureEnabled } from "@/lib/feature-controls";
import { fillTermSheetDocx } from "@/lib/term-sheet/fill";
import { gateTermSheetApi } from "@/lib/term-sheet/gate";
import { parseFormType, sanitizeValues } from "@/lib/term-sheet/values";

export const dynamic = "force-dynamic";

/** The filled Word file: the template with only the blanks changed. */
export async function POST(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeatureEnabled(g.flags, "founder", "term_sheet_word_export")) {
    return NextResponse.json({ error: "Word export is not available." }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { formType?: unknown; values?: unknown };
    const formType = parseFormType(body.formType);
    if (!formType) return NextResponse.json({ error: "Choose a term sheet template." }, { status: 400 });
    const buf = await fillTermSheetDocx(formType, sanitizeValues(formType, body.values));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="term-sheet.docx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to build the Word file." }, { status: 500 });
  }
}
