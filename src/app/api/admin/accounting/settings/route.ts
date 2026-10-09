import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { isEntity } from "@/lib/accounting/core";
import { getPaymentInstructions, savePaymentInstructions } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** GET ?entity=: the bank details printed on that entity's invoices. */
export async function GET(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const e = new URL(req.url).searchParams.get("entity");
  return NextResponse.json({ instructions: await getPaymentInstructions(isEntity(e) ? e : "icfo_capital_global") });
}

/** PUT { entity, instructions } */
export async function PUT(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const b = await body(req);
  try {
    if (!isEntity(b.entity)) throw new Error("Choose a company.");
    return NextResponse.json({ ok: true, instructions: await savePaymentInstructions(b.entity, b.instructions, g.userId) });
  } catch (e) {
    return fail(e, 500);
  }
}
