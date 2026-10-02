import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OdooPager } from "@/components/admin/OdooPager";
import { verifyFounderToken } from "@/lib/marketing/match-campaign/token";
import { loadFounderProfile } from "@/lib/marketing/match-campaign/store";
import { recordInvestorView } from "@/lib/marketing/match-campaign/followups";
import { stageLabel } from "@/lib/marketing/match-campaign/fields";
import { UNNAMED } from "@/lib/marketing/match-campaign/email";
import { Avatar, ExpiredLink } from "../../review-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor profile · iCapOS",
  robots: { index: false, follow: false },
};

/**
 * One matched investor's profile for a founder, opened from the review flow
 * email or match list by signed token (no login). Public facts only: type,
 * firm, stages, check size, sectors with the matched ones highlighted. Contact
 * details and Request introduction stay locked behind a plan. The pager steps
 * through open matches only. preview=1 (admin) does not record a view.
 */
export default async function FounderInvestorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; n: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token, n } = await params;
  const { preview } = await searchParams;
  const id = verifyFounderToken(token);
  if (!id) notFound();
  const isPreview = preview === "1";
  const data = await loadFounderProfile(id, Number(n), { track: !isPreview });
  if (!data) notFound();
  if (data.page.expired && !isPreview) return <ExpiredLink token={token} />;
  // Same per investor view count the match page uses, so follow ups can name
  // the investor a founder looked at most.
  if (!isPreview) await recordInvestorView(id, data.matchId).catch(() => false);

  const { page, match: m, position, openCount } = data;
  const q = isPreview ? "?preview=1" : "";
  const matched = new Set((m.matched_sectors ?? []).map((s) => s.toLowerCase()));
  const sectors = [...m.sectors].sort((a, b) => Number(matched.has(b.toLowerCase())) - Number(matched.has(a.toLowerCase())));
  const fitStage = page.stages.find((s) => m.stages.includes(s));
  const fitParts = [fitStage ? `Invests at ${stageLabel(fitStage)}` : null, m.matched_sectors?.length ? `Backs ${m.matched_sectors.join(", ")}` : null].filter(Boolean);
  const firstName = (m.investor_name || UNNAMED).split(/\s+/)[0];

  return (
    <section className="bg-site-paper px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/matches/${token}${q}`} className="text-[13px] text-slate-600 hover:text-site-blue"><i className="ti ti-arrow-left" aria-hidden="true" /> All {page.matchCount} matches</Link>
          <OdooPager
            label={`${position} / ${openCount}`}
            prev={{ href: position > 1 ? `/matches/${token}/i/${position - 1}${q}` : undefined, disabled: position <= 1 }}
            next={{ href: position < openCount ? `/matches/${token}/i/${position + 1}${q}` : undefined, disabled: position >= openCount }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={m.investor_name} size={48} />
            <div>
              <h1 className="font-site-display text-xl font-bold text-site-navy">{m.investor_name || UNNAMED}</h1>
              <p className="text-[13px] text-slate-500">{[m.investor_type, m.investor_firm].filter(Boolean).join(" · ") || "Investor"}</p>
            </div>
          </div>

          {fitParts.length ? (
            <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-800">
              <p className="text-[13px] font-semibold">Why this investor fits {page.company}</p>
              <p className="text-[12px]">{fitParts.join(" · ")}</p>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-slate-400">Stages</p><p className="text-[13px] text-site-navy">{m.stages.map(stageLabel).join(", ") || "Not listed"}</p></div>
            <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-slate-400">Check size</p><p className="text-[13px] text-site-navy">{m.check_band ?? "Not listed"}</p></div>
          </div>

          {sectors.length ? (
            <>
              <p className="mb-1.5 text-[13px] font-semibold text-site-navy">Sectors</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {sectors.map((s) => (
                  <span key={s} className={`rounded-md px-2 py-0.5 text-[12px] ${matched.has(s.toLowerCase()) ? "bg-emerald-50 text-emerald-800" : "bg-[#E6F1FB] text-[#0C447C]"}`}>{s}</span>
                ))}
              </div>
            </>
          ) : null}

          <div className="mb-5 rounded-lg border border-dashed border-slate-300 p-3">
            <p className="mb-1.5 text-[13px] font-semibold text-site-navy"><i className="ti ti-lock" aria-hidden="true" /> Contact and introduction</p>
            <p className="text-[12px] text-slate-400">Email ••••••@•••••.com</p>
            <p className="text-[12px] text-slate-400">LinkedIn ••••••</p>
            <p className="mb-3 text-[12px] text-slate-400">Request introduction</p>
            <a href={`/mc/${token}?a=intro`} className="block rounded-lg border border-site-blue px-5 py-2.5 text-center text-sm font-semibold text-site-blue hover:bg-slate-50">Choose a plan to unlock</a>
          </div>

          <p className="text-[15px] font-semibold text-site-navy">Is {firstName} your best first call?</p>
          <p className="mb-3 mt-1 text-[13px] text-slate-500">Free 15 minute match review. We&apos;ll rank all {page.matchCount} for {page.company}.</p>
          <a href={`/mc/${token}?a=call`} className="block rounded-lg bg-site-blue px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90">Pick a time for your match review</a>
        </div>
        <p className="mt-4 text-[11px] text-slate-400">Profile built from information in the iCFO investor network. Investors can ask to be hidden.</p>
      </div>
    </section>
  );
}
