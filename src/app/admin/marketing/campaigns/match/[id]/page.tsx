import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { campaignCounts, getMatchCampaign } from "@/lib/match-campaigns/service";
import { getLists } from "@/lib/marketing/contacts";
import { marketingDb } from "@/lib/marketing/db";
import { MatchCampaignWizard } from "./MatchCampaignWizard";

export const dynamic = "force-dynamic";

const FUNDING_STAGES = ["Pre-Seed", "Seed Round", "Series A", "Series B", "Growth"];

async function industryOptions(): Promise<string[]> {
  const { data } = await marketingDb().from("vocabulary_options").select("label, sort_order").eq("list", "industry").eq("archived", false).order("sort_order");
  return ((data ?? []) as Array<{ label: string }>).map((r) => r.label);
}

// Admin, Marketing Hub, Campaigns, Match campaign: the seven step flow (approved mockup).
export default async function MatchCampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const { step } = await searchParams;
  const campaign = await getMatchCampaign(id);
  if (!campaign) notFound();
  const [counts, lists, industries] = await Promise.all([
    campaignCounts(id),
    getLists().catch(() => []),
    industryOptions().catch(() => []),
  ]);
  const s = Number(step);
  const initialStep = Number.isInteger(s) && s >= 1 && s <= 7
    ? s
    : campaign.status === "scheduled" || campaign.status === "sent" ? 7
    : counts.withMatches > 0 ? 4
    : counts.selected > 0 ? 3
    : 2;
  return (
    <MatchCampaignWizard
      initialCampaign={campaign}
      initialCounts={counts}
      initialStep={initialStep}
      lists={lists.filter((l) => !l.archived).map((l) => ({ id: l.id, name: l.name }))}
      industries={industries}
      stages={FUNDING_STAGES}
    />
  );
}
