import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { listCampaignFounders, searchFounders, setCampaignFounders, updateMatchCampaign } from "@/lib/marketing/match-campaign/store";
import { sanitizeFilter } from "@/lib/marketing/match-campaign/filter-params";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/admin/marketing/match/check — put the selected founders on the
// campaign and run the data check. Either explicit founder_ids, or every
// founder that fits the list step's filter (select_all, up to 1,000).
// With neither, re-runs the check on the founders already on the campaign
// (after a Data check setting changes).
export async function POST(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    campaign_id?: string; founder_ids?: string[]; select_all?: boolean; filter?: unknown; recheck?: boolean;
  } | null;
  if (!body?.campaign_id) return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  try {
    let ids = Array.isArray(body.founder_ids) ? body.founder_ids.filter((x) => typeof x === "string") : [];
    const f = body.filter !== undefined ? sanitizeFilter(body.filter) : null;
    if (body.select_all && f) {
      const all = await searchFounders({
        listId: f.list, founderTypes: f.types, industries: f.industries, stages: f.stages,
        pipelineStages: f.pipeline, filledOnly: f.filled, q: f.q, limit: 1000,
      });
      ids = all.rows.map((r) => r.id);
    }
    if (body.recheck) ids = (await listCampaignFounders(body.campaign_id)).map((r) => r.founder_contact_id);
    if (ids.length === 0) return NextResponse.json({ error: "Select at least one founder." }, { status: 400 });
    if (f) await updateMatchCampaign(body.campaign_id, { config: { founder_list_id: f.list ?? null } });
    const summary = await setCampaignFounders(body.campaign_id, ids);
    const founders = await listCampaignFounders(body.campaign_id);
    return NextResponse.json({ summary, founders });
  } catch (err) {
    return errorJson(err);
  }
}
