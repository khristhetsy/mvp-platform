import { NextResponse } from "next/server";
import { accountingGuard } from "@/lib/accounting/api";
import { getInvoice, invoicePdf } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Staff view of the invoice PDF. ?download=1 attaches. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const inv = await getInvoice((await params).id);
  if (!inv) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const { pdf, fileName } = await invoicePdf(inv);
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`, "Cache-Control": "private, no-store" },
  });
}
