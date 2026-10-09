import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { decideTransaction, type BankDecision } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** POST { action: "match", invoice_id } | { action: "categorize", category } | { action: "ignore" } | { action: "reset" } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const b = await body(req);
  try {
    let d: BankDecision;
    if (b.action === "match" && typeof b.invoice_id === "string") d = { action: "match", invoice_id: b.invoice_id, send_receipt: b.send_receipt === true };
    else if (b.action === "categorize" && typeof b.category === "string") d = { action: "categorize", category: b.category };
    else if (b.action === "ignore") d = { action: "ignore" };
    else if (b.action === "reset") d = { action: "reset" };
    else throw new Error("Unknown action.");
    return NextResponse.json(await decideTransaction((await params).id, d, g.userId));
  } catch (e) {
    return fail(e);
  }
}
