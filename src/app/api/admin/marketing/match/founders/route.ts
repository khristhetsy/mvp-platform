import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { searchFounders } from "@/lib/marketing/match-campaign/store";
import { filterFromQuery } from "@/lib/marketing/match-campaign/filter-params";

export const dynamic = "force-dynamic";

// GET /api/admin/marketing/match/founders — founder list step: a saved list and/or filters.
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const p = new URL(request.url).searchParams;
  const f = filterFromQuery(p);
  try {
    const result = await searchFounders({
      listId: f.list,
      founderTypes: f.types,
      industries: f.industries,
      stages: f.stages,
      pipelineStages: f.pipeline,
      filledOnly: f.filled,
      q: f.q,
      limit: Number(p.get("limit") ?? 200) || 200,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorJson(err);
  }
}
