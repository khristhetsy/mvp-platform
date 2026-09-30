import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import {
  allFounderIds,
  campaignCounts,
  getMatchCampaign,
  previewForFounder,
  runDataCheck,
  runMatchingBatch,
  scheduleMatchCampaign,
  sendMatchCampaignBatch,
  sendMatchTest,
  setMatchCampaignStatus,
  setMatchRemoved,
  updateMatchCampaign,
  type FounderFilter,
} from "@/lib/match-campaigns/service";
import { loadMatchResults } from "@/lib/match-campaigns/results";
import type { MatchConfig } from "@/lib/match-campaigns/core";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown, status = 400) {
  return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
}

// GET — campaign, step counts, and (view=results|preview) the extra data for a step.
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const campaign = await getMatchCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Match campaign not found" }, { status: 404 });
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  try {
    if (view === "preview") {
      return NextResponse.json({ preview: await previewForFounder(id, url.searchParams.get("founder")) });
    }
    if (view === "results") {
      return NextResponse.json({ results: await loadMatchResults(id, campaign.config.campaign_cost_cents), counts: await campaignCounts(id) });
    }
    return NextResponse.json({ campaign, counts: await campaignCounts(id) });
  } catch (err) {
    return fail(err, 500);
  }
}

// PATCH — edit name, sender and settings (subject, daily cap, EU rule, sources…).
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string; from_name?: string; from_email?: string; reply_to?: string | null; config?: Partial<MatchConfig> } | null;
  try {
    return NextResponse.json({ campaign: await updateMatchCampaign(id, body ?? {}) });
  } catch (err) {
    return fail(err);
  }
}

type Action =
  | { action: "check"; founderIds?: string[]; filter?: FounderFilter }
  | { action: "run" }
  | { action: "remove" | "restore"; matchId: string }
  | { action: "test"; to?: string; founder?: string | null }
  | { action: "schedule"; at?: string | null }
  | { action: "send_now" }
  | { action: "pause" | "cancel" | "unschedule" };

// POST { action } — one step of the flow. Nothing here emails an investor.
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Action | null;
  if (!body?.action) return NextResponse.json({ error: "action is required" }, { status: 400 });
  try {
    switch (body.action) {
      case "check": {
        const ids = body.filter ? await allFounderIds(body.filter) : (body.founderIds ?? []);
        if (ids.length === 0) return NextResponse.json({ error: "Select at least one founder." }, { status: 400 });
        const summary = await runDataCheck(id, ids);
        return NextResponse.json({ summary, counts: await campaignCounts(id) });
      }
      case "run": {
        // Batches run until the time budget is used; the screen calls again while remaining > 0.
        const started = Date.now();
        let processed = 0;
        let remaining = 1;
        while (remaining > 0 && Date.now() - started < 45_000) {
          const r = await runMatchingBatch(id, 150);
          processed += r.processed;
          remaining = r.remaining;
          if (r.processed === 0) break;
        }
        return NextResponse.json({ processed, remaining, counts: await campaignCounts(id) });
      }
      case "remove":
      case "restore":
        await setMatchRemoved(body.matchId, body.action === "remove", auth.profile.id);
        return NextResponse.json({ ok: true, counts: await campaignCounts(id) });
      case "test": {
        const to = body.to?.trim() || (auth.profile as { email?: string | null }).email || "";
        const r = await sendMatchTest(id, to, body.founder ?? null);
        return NextResponse.json({ ...r, to }, { status: r.ok ? 200 : 400 });
      }
      case "schedule":
        return NextResponse.json({ campaign: await scheduleMatchCampaign(id, body.at ?? null) });
      case "send_now": {
        const campaign = await scheduleMatchCampaign(id, null);
        const r = await sendMatchCampaignBatch(id);
        return NextResponse.json({ campaign, ...r, counts: await campaignCounts(id) });
      }
      case "pause":
        await setMatchCampaignStatus(id, "paused");
        return NextResponse.json({ ok: true });
      case "unschedule":
        await setMatchCampaignStatus(id, "draft");
        return NextResponse.json({ ok: true });
      case "cancel":
        await setMatchCampaignStatus(id, "cancelled");
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return fail(err);
  }
}
