import { NextResponse } from "next/server";
import { requireContractsApi } from "@/lib/contracts/access";
import { listEntities, listTemplateCards } from "@/lib/contracts/store";
import { renderConfigured } from "@/lib/contracts/render-pdf";

export const dynamic = "force-dynamic";

/** GET — master library (latest version of each), entities, and whether rendering is configured. */
export async function GET(): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { db, isAdmin } = auth.actor;
  const [templates, entities] = await Promise.all([listTemplateCards(db), listEntities(db)]);
  return NextResponse.json({ templates, entities, renderConfigured: renderConfigured(), isAdmin });
}
