import { NextResponse } from "next/server";
import { accountingGuard, fail } from "@/lib/accounting/api";
import { deletePayment } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** DELETE: remove a recorded payment (a matched deposit goes back to review). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    return NextResponse.json({ invoice: await deletePayment((await params).id) });
  } catch (e) {
    return fail(e);
  }
}
