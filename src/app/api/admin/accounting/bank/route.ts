import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { connectPlaid, createPlaidLinkToken, importBankFile, markReconnected, syncAllBanks } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { action: "link_token" | "connect" | "reconnected" | "sync" | "import", ... } */
export async function POST(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  const b = await body(req);
  try {
    switch (b.action) {
      case "link_token":
        return NextResponse.json({ link_token: await createPlaidLinkToken(g.userId, typeof b.item_id === "string" ? b.item_id : null) });
      case "connect":
        if (typeof b.public_token !== "string") throw new Error("Missing the bank sign in result.");
        return NextResponse.json(await connectPlaid({ public_token: b.public_token, institution_name: typeof b.institution_name === "string" ? b.institution_name : null, entity: b.entity }, g.userId));
      case "reconnected":
        if (typeof b.item_id !== "string") throw new Error("Missing the bank connection.");
        return NextResponse.json(await markReconnected(b.item_id));
      case "sync":
        return NextResponse.json(await syncAllBanks());
      case "import":
        if (typeof b.text !== "string" || b.text.length > 5_000_000) throw new Error("Choose a CSV or QFX file under 5 MB.");
        return NextResponse.json(await importBankFile({ text: b.text, account_id: typeof b.account_id === "string" ? b.account_id : null, account_name: typeof b.account_name === "string" ? b.account_name : null, entity: b.entity }));
      default:
        throw new Error("Unknown action.");
    }
  } catch (e) {
    return fail(e);
  }
}
