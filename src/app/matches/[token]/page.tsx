import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/app/fit/FitFunnelClient";
import { loadPublicMatchPage } from "@/lib/match-campaigns/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your investor matches · iCapOS",
  robots: { index: false, follow: false },
};

/** A founder on a paid plan is signed in: their names and introductions live in the app. */
async function paidViewer(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    return founderEntitlements(await getUserPlan(data.user.id)).canBrokerIntros;
  } catch {
    return false;
  }
}

// Public match page from a Match campaign email. Opened by a signed token, no login.
// Each match expands like the results on icapos.com/fit (same component, unchanged).
// Investor names and contact info stay hidden until the founder is on a plan.
export default async function MatchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadPublicMatchPage(token);
  if (!page) notFound();
  const paid = await paidViewer();
  const meta = [page.industry, page.stage].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-5 text-white" style={{ background: "linear-gradient(135deg,#0A1A40,#1A6CE4)" }}>
            <h1 className="text-[20px] font-semibold">{page.company}: {page.matchCount} investor {page.matchCount === 1 ? "match" : "matches"}</h1>
            <p className="mt-1 text-[13px] text-blue-100">{meta ? `${meta} · ` : ""}from our network of {page.network} investors</p>
          </div>
          <div className="p-5">
            {paid ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-900">
                Your plan is active. See investor names and request introductions in{" "}
                <Link href="/founder/matches" className="font-semibold underline">your matches</Link>.
              </div>
            ) : (
              <p className="mb-4 text-[13.5px] leading-relaxed text-slate-600">
                These investors in our network fit your industry and stage. Tap a match to see its profile.
                Names and contact info unlock with a plan.
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              {page.matches.map((m) => <MatchCard key={m.contactId} m={m} />)}
            </div>
            {!paid && page.matchCount > page.matches.length ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-[12px] text-slate-500">
                Showing your top {page.matches.length} of {page.matchCount} matches.
              </p>
            ) : null}
            {!paid ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-[12px] text-slate-500">
                Contact info hidden. Get introduced today to unlock it and request an introduction.
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href={page.callUrl} className="flex-1 rounded-lg px-5 py-3 text-center text-sm font-semibold text-white" style={{ background: "#1A6CE4" }}>
                Schedule a call with us
              </Link>
              {paid ? (
                <Link href="/founder/matches" className="flex-1 rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold" style={{ color: "#1A6CE4" }}>
                  Request introductions
                </Link>
              ) : (
                <Link href={page.introUrl} className="flex-1 rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold" style={{ color: "#1A6CE4" }}>
                  Get introduced today
                </Link>
              )}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">
              Plans from $49/month. iCapOS is not a broker-dealer and does not raise capital or guarantee funding.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
