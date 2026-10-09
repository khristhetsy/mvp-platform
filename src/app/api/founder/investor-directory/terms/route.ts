/** Accept the investor directory terms of use. POST → { acceptedAt } (stored on the founder's record, shown to admins). */
import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { acceptTerms } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { agree?: boolean } | null;
  if (body?.agree !== true) return NextResponse.json({ error: "Check the box to continue." }, { status: 400 });
  try {
    return NextResponse.json({ acceptedAt: await acceptTerms(auth.profile.id, auth.company.id) });
  } catch (err) {
    console.error("[investor-directory] terms failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't save your acceptance. Try again." }, { status: 500 });
  }
}
