import { NextResponse } from "next/server";
import { offerableSectors } from "@/lib/fit/match-investors";

export const dynamic = "force-dynamic";

// Public: the sectors offerable at Q3 — only those a gated investor actually covers.
export async function GET(): Promise<Response> {
  const sectors = await offerableSectors().catch(() => []);
  return NextResponse.json({ sectors });
}
