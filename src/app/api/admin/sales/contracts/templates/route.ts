import { NextResponse } from "next/server";
import { requireContractsApi } from "@/lib/contracts/access";
import { listEntities, listTemplateCards } from "@/lib/contracts/store";
import { renderConfigured } from "@/lib/contracts/render-pdf";
import { MASTER_SEED_KEYS } from "@/lib/contracts/seed-keys";

export const dynamic = "force-dynamic";

/** GET — master library (latest version of each), entities, and whether rendering is configured. */
export async function GET(): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { db, isAdmin } = auth.actor;
  const [templates, entities] = await Promise.all([listTemplateCards(db), listEntities(db)]);
  // Masters shipped with the app but not installed yet (e.g. one added after the first install).
  const { data: keys } = await db.from("contract_templates").select("key");
  const installed = new Set(((keys ?? []) as { key: string }[]).map((k) => k.key));
  const missingMasters = MASTER_SEED_KEYS.filter((k) => !installed.has(k)).length;
  return NextResponse.json({ templates, entities, renderConfigured: renderConfigured(), isAdmin, missingMasters });
}
