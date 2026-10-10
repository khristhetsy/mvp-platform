import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { isEntity } from "@/lib/accounting/core";
import { getLetterhead, saveLetterhead } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** GET ?entity=: the logo and contact lines printed on that company's invoices. */
export async function GET(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const e = new URL(req.url).searchParams.get("entity");
  return NextResponse.json({ letterhead: await getLetterhead(isEntity(e) ? e : "icfo_capital_global") });
}

/** PUT { entity, letterhead: { logo (PNG or JPG data URL, or null), address, phone, email } } */
export async function PUT(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const b = await body(req);
  try {
    if (!isEntity(b.entity)) throw new Error("Choose a company.");
    return NextResponse.json({ ok: true, letterhead: await saveLetterhead(b.entity, b.letterhead, g.userId) });
  } catch (e) {
    return fail(e);
  }
}
