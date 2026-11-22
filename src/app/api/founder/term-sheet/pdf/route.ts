import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateTermSheetApi } from "@/lib/term-sheet/gate";
import { renderTermSheetPdf } from "@/lib/term-sheet/pdf";
import { parseFormType, sanitizeValues } from "@/lib/term-sheet/values";

export const dynamic = "force-dynamic";

/** PDF of the term sheet with the values in the request body. Used by Preview and the PDF button. */
export async function POST(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { formType?: unknown; values?: unknown; download?: boolean };
    const formType = parseFormType(body.formType);
    if (!formType) return NextResponse.json({ error: "Choose a term sheet template." }, { status: 400 });
    const buf = await renderTermSheetPdf(formType, sanitizeValues(formType, body.values));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${body.download ? "attachment" : "inline"}; filename="term-sheet.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to render the PDF." }, { status: 500 });
  }
}
