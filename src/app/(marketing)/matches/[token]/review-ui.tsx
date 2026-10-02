/**
 * Founder facing pages of the Match campaign review flow (server components):
 * the matches list (Screen 2), the expired link page and shared pieces used by
 * the investor profile (Screen 3). Locked matches arrive without any identity
 * (see lockedMatch), so nothing here can leak a locked investor's name.
 */
import Link from "next/link";
import { stageLabel } from "@/lib/marketing/match-campaign/fields";
import { UNNAMED, matchedOn } from "@/lib/marketing/match-campaign/email";
import type { FounderPageData } from "@/lib/marketing/match-campaign/store";
import type { MaskedMatch } from "@/lib/marketing/match-campaign/types";
import { LockedMatchRow } from "./LockedMatchRow";

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] font-semibold text-[#0C447C]"
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function ReviewButtons({ token, compact = false }: { token: string; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <a href={`/mc/${token}?a=call`} className="block rounded-lg bg-site-blue px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90">
        Pick a time for your match review
      </a>
      <a href={`/mc/${token}?a=intro`} className="block rounded-lg border border-site-blue bg-white px-5 py-3 text-center text-sm font-semibold text-site-blue hover:bg-slate-50">
        Choose a plan to unlock
      </a>
    </div>
  );
}

export function ExpiredLink({ token }: { token: string }) {
  return (
    <section className="bg-site-paper px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="font-site-display text-xl font-bold text-site-navy">This link has expired</h1>
        <p className="mt-2 text-sm text-slate-500">Match lists change as investors update their mandates. Book a free 15 minute match review and we&apos;ll walk you through your current matches.</p>
        <div className="mt-5"><ReviewButtons token={token} compact /></div>
      </div>
    </section>
  );
}

function OpenRow({ token, m, n, stages }: { token: string; m: MaskedMatch; n: number; stages: string[] }) {
  return (
    <Link href={`/matches/${token}/i/${n}`} className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 hover:bg-slate-50">
      <Avatar name={m.investor_name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-site-navy">
          {m.investor_name || UNNAMED}
          {m.investor_firm ? <span className="font-normal text-slate-500"> · {m.investor_firm}</span> : null}
        </span>
        <span className="block truncate text-[12px] text-slate-500">{matchedOn(m, stages)}</span>
      </span>
      <i className="ti ti-chevron-right text-slate-400" aria-hidden="true" />
    </Link>
  );
}

export function ReviewMatchesPage({ token, page, paid }: { token: string; page: FounderPageData; paid: boolean }) {
  const meta = [page.industry, page.stages.map(stageLabel).join(", ")].filter(Boolean).join(" · ");
  const open = page.matches.slice(0, page.visibleCount);
  const locked = page.matches.slice(page.visibleCount);
  return (
    <section className="bg-site-paper px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="font-site-display text-2xl font-extrabold tracking-tight text-site-navy">{page.company}&apos;s investor matches</h1>
        <p className="mt-1 text-sm text-slate-500">{meta ? `${meta} · ` : ""}{page.matchCount} match{page.matchCount === 1 ? "" : "es"}</p>

        {paid ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Your plan is active. See your matched investors and request introductions in your workspace.
            <Link href="/founder/matches" className="ml-2 font-semibold underline">Go to your investor matches</Link>
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {open.map((m, i) => <OpenRow key={`o${i}`} token={token} m={m} n={i + 1} stages={page.stages} />)}
          {locked.map((m, i) => <LockedMatchRow key={`l${i}`} token={token} line={matchedOn(m, page.stages)} matchCount={page.matchCount} />)}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[15px] font-semibold text-site-navy">Which 2 should you approach first?</p>
          <p className="mb-4 mt-1 text-[13px] text-slate-500">In a free 15 minute match review, we&apos;ll rank all {page.matchCount} for {page.company}.</p>
          <ReviewButtons token={token} />
        </div>
        <p className="mt-6 text-xs text-slate-400">These investors match your industry and stage in our network. They have not been contacted about your company.</p>
      </div>
    </section>
  );
}
