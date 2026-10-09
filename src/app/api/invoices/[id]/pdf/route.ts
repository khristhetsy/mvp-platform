import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getInvoice, invoicePdf } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The customer's link to their invoice PDF (from the invoice email). Customers
 * have no account, so the link carries the invoice's random token; a wrong
 * token answers the same as a missing invoice.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const inv = await getInvoice((await params).id).catch(() => null);
  const ok = inv && token.length === inv.public_token.length && timingSafeEqual(Buffer.from(token), Buffer.from(inv.public_token));
  if (!inv || !ok || inv.status === "draft" || inv.status === "scheduled") return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const { pdf, fileName } = await invoicePdf(inv);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "private, no-store" },
  });
}
