import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/app/fit/FitFunnelClient";
import { verifyFounderToken } from "@/lib/marketing/match-campaign/token";
import { loadFounderPage } from "@/lib/marketing/match-campaign/store";
import { investorNetworkCount, networkLabel } from "@/lib/marketing/match-campaign/investors";
import { stageLabel } from "@/lib/marketing/match-campaign/fields";
import { UNNAMED } from "@/lib/marketing/match-campaign/email";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { ExpiredLink, ReviewMatchesPage } from "./review-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your investor matches · iCapOS",
  robots: { index: false, follow: false },
};

/** Signed in as a founder on a plan that can request introductions. */
async function paidFounder(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    return founderEntitlements(await getUserPlan(data.user.id)).canBrokerIntros;
  } catch {
    return false;
  }
}

/**
 * The founder's match page, opened from the Match campaign email by a signed
 * token (no login). Every match is a collapsed row that expands with the /fit
 * results card. Investor name and firm show; contact details never do. A
 * founder on a paid plan goes to their investor matches in the app, which
 * handles introduction requests through iCFO. The admin preview (preview=1)
 * always shows the unpaid view, whoever is signed in.
 */
export default async function FounderMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;
  const id = verifyFounderToken(token);
  if (!id) notFound();
  const isPreview = preview === "1";
  const [page, network, paid] = await Promise.all([loadFounderPage(id, { track: !isPreview }), investorNetworkCount(), isPreview ? false : paidFounder()]);
  if (!page) notFound();

  // Review flow campaigns: the match review layout (open matches by name, the
  // rest locked, booking a match review as the primary action).
  if (page.flow === "review") {
    if (page.expired && !isPreview) return <ExpiredLink token={token} />;
    return <ReviewMatchesPage token={token} page={page} paid={paid} />;
  }

  const meta = [page.industry, page.stages.map(stageLabel).join(", ")].filter(Boolean).join(" · ");
  const hidden = Math.max(0, page.matchCount - page.matches.length);
  const callHref = `/mc/${token}?a=call`;
  const planHref = `/mc/${token}?a=intro`;

  return (
    <section className="bg-site-paper px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">Your investor matches</p>
        <h1 className="mt-2 font-site-display text-3xl font-extrabold tracking-tight text-site-navy">
          {page.company}: {page.matchCount} investor match{page.matchCount === 1 ? "" : "es"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {meta ? `${meta} · ` : ""}from our network of {networkLabel(network)} investors
        </p>
        <p className="mt-4 text-[13px] text-slate-500">Tap a match to expand it, the same way results expand on icapos.com/fit.</p>

        {paid ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Your plan is active. See your matched investors by name and request introductions in your workspace.
            <Link href="/founder/matches" className="ml-2 font-semibold underline">Go to your investor matches</Link>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {page.matches.map((m, i) => (
            <div key={i}>
              <MatchCard
                m={{
                  contactId: `match-${i}`,
                  company: [m.investor_name || UNNAMED, m.investor_firm].filter(Boolean).join(" · "),
                  summary: "",
                  fit: m.match_score,
                  sectors: m.sectors,
                  types: m.investor_type ? [m.investor_type] : [],
                  stage: m.stages.map(stageLabel).join(", ") || null,
                  checkSize: m.check_band,
                  revenue: null,
                  score: null,
                  tier: null,
                }}
              />
              <p className="mt-1 px-1 text-[12px] text-slate-500">
                <i className="ti ti-lock" aria-hidden="true" /> Contact details hidden. Choose a plan to request an introduction.
              </p>
            </div>
          ))}
          {hidden > 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-500">
              + {hidden} more match{hidden === 1 ? "" : "es"}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href={callHref} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white hover:opacity-90">Schedule a call with us</a>
          <a href={planHref} className="rounded-lg border border-site-blue px-5 py-3 text-sm font-semibold text-site-blue hover:bg-white">Choose a plan to unlock</a>
        </div>
        <p className="mt-6 text-xs text-slate-400">
          These investors match your industry and stage in our network. They have not been contacted about your company.
        </p>
      </div>
    </section>
  );
}
