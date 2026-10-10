import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { parseMoneyToCents, type PaymentMethod } from "@/lib/accounting/core";
import { deleteInvoice, getInvoiceDetail, recordPayment, sendInvoice, updateInvoice, voidInvoice } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const detail = await getInvoiceDetail((await params).id);
  if (!detail) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  return NextResponse.json(detail);
}

/** PATCH: edit a draft or scheduled invoice. */
export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    return NextResponse.json({ invoice: await updateInvoice((await params).id, await body(req)) });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE: remove an invoice with no payments recorded (drafts from the record page, any from the list). */
export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    await deleteInvoice((await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** POST { action: "send" | "remind" | "void" | "payment", ... } */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const id = (await params).id;
  const b = await body(req);
  try {
    switch (b.action) {
      case "send":
      case "remind":
        return NextResponse.json(await sendInvoice(id, g.userId, { to: typeof b.to === "string" ? b.to : null, reminder: b.action === "remind" }));
      case "void":
        return NextResponse.json({ invoice: await voidInvoice(id) });
      case "payment": {
        const cents = parseMoneyToCents(b.amount);
        if (cents === null) throw new Error("Enter the amount received.");
        return NextResponse.json(await recordPayment(id, {
          amount_cents: cents,
          paid_on: typeof b.paid_on === "string" ? b.paid_on : undefined,
          method: b.method as PaymentMethod,
          reference: typeof b.reference === "string" ? b.reference : null,
          send_receipt: b.send_receipt === true,
        }, g.userId));
      }
      default:
        throw new Error("Unknown action.");
    }
  } catch (e) {
    return fail(e);
  }
}
