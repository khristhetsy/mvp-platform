import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentChat } from "@/components/ir-agent/AgentChat";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { isReservedSlug, validateCompanySlug, validateEnding } from "@/lib/ir-agent/slug";
import { buildPublicConfig, getLiveAgentByAddress } from "@/lib/ir-agent/store";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ company: string; ending: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function loadAgent(params: Props["params"]) {
  const { company, ending } = await params;
  if (isReservedSlug(company) || !validateCompanySlug(company).ok || !validateEnding(ending).ok) return null;
  return getLiveAgentByAddress(company, ending);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await loadAgent(params);
  if (!agent) return { robots: { index: false, follow: false } };
  return {
    title: `${agent.display_name} at ${agent.company_name}`,
    description: `Talk to ${agent.display_name}, investor relations at ${agent.company_name}, and book a call with the founder.`,
    robots: { index: false, follow: false },
  };
}

/**
 * A founder's investor relations agent: icapos.com/[company]/[ending].
 * Public, no sign in. Only a live agent renders; anything else is a 404, so a
 * typo under a static route never shows a stranger's page. A tagged link
 * (?src=linkedin) is carried onto the conversation record and the booking.
 */
export default async function FounderAgentPage({ params, searchParams }: Props) {
  const agent = await loadAgent(params);
  if (!agent) notFound();

  const sp = await searchParams;
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])));
  const sourceTag = sourceTagFromQuery(query);
  const config = await buildPublicConfig(agent);

  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4 py-6">
      <AgentChat config={config} sourceTag={sourceTag} />
      <p className="mt-3 text-[11px] text-slate-400">
        {agent.company_name} · Investor relations, 24/7
      </p>
    </main>
  );
}
