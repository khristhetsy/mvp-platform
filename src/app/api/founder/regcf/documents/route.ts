import { NextResponse } from "next/server";
import { gateRegCfFounderApi } from "@/lib/regcf/gate";
import { getRegCfDocuments } from "@/lib/regcf/store";

export const dynamic = "force-dynamic";

/** GET — the founder's saved Reg CF draft documents. */
export async function GET(): Promise<Response> {
  const gate = await gateRegCfFounderApi();
  if ("error" in gate) return gate.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documents = await getRegCfDocuments(gate.supabase, gate.profile.id);
  return NextResponse.json({ documents });
}
