/**
 * Capital-funnel post library — ten ready-written LinkedIn posts (from
 * icfo-ten-posts.md). Each carries its own attribution tag so the funnel can trace
 * which argument converts; the CTA + tagged /fit link post as the first comment.
 * Loaded into the composer as a starting draft — never auto-published.
 */
import type { Archetype } from "@/lib/social/composer";

export type LibraryPost = {
  n: number;
  title: string;
  archetype: Archetype;
  tag: string;   // attribution tag, e.g. li-kt-01
  cta: string;   // first-comment text before the link
  body: string;
};

/** ?s= tag → the tagged /fit URL for the first comment. */
export function fitLink(tag: string): string {
  return `https://icapos.com/fit?s=${tag}`;
}

/** Strongest arguments first (build-spec cadence). */
export const SUGGESTED_ORDER = [1, 5, 8, 3, 7];

export const POST_LIBRARY: LibraryPost[] = [
  {
    n: 1, title: "Thesis mismatch", archetype: "proof_case", tag: "li-kt-01",
    cta: "Four questions and you'll see which investors in our network your raise clears:",
    body: `About 70% of the investors who pass on you had already ruled you out before the meeting.

Wrong stage, wrong sector, wrong cheque size, wrong geography. Their criteria did the work; the meeting was a formality neither of you knew was a formality.

Founders read that as a judgement on the company. It almost never is.

The uncomfortable part: that information mostly exists. It's just scattered across filings, portfolio pages and conversations nobody wrote down, so founders pitch everyone and hope.

We keep it structured for the investors in our network. Four questions and you'll see which ones your raise actually clears.`,
  },
  {
    n: 2, title: "Rating before list", archetype: "teardown", tag: "li-kt-02",
    cta: "The rating comes first, then the list. Four questions to start:",
    body: `We rate you before we build your list, and founders hate that order.

They want the names. We run the rating first anyway.

The reason is that a list is only worth having if you survive contact with it. Send materials to forty well-matched investors with an unexplained cap table and you've burned forty relationships you can't easily go back to.

Rating first means you find the weak spots before an investor does. It's slower by about two weeks and it's the difference between a list that works and a list you spend once.`,
  },
  {
    n: 3, title: "Start where you are", archetype: "teardown", tag: "li-kt-03",
    cta: "Bring what you have. Four questions:",
    body: `Most platforms want you arriving with a finished deck, a clean cap table and a three-statement model.

If you had those, you wouldn't need much help.

Readiness is what we produce, not what we require. Bring a rough deck and a spreadsheet — what comes back is an ordered list of what to fix, worst first.

Founders routinely score in the forties on financial model and the seventies on narrative. That gap is normal and it's fixable in weeks. What isn't fixable is finding out about it from an investor.`,
  },
  {
    n: 4, title: "The math", archetype: "teardown", tag: "li-kt-04",
    cta: "The two stages worth attacking start here:",
    body: `Multiply the four stages of a cold raise and you get about 0.03%.

Response, meeting, diligence, term sheet. Published benchmarks, not our numbers.

Everyone quotes that figure to sound sobering. It's more useful as a map.

Two of those four stages move when you change what you bring. Two don't move at all — a fund writing eight cheques a year against three thousand companies is arithmetic, not a problem to solve.

Anyone promising to change the base rate is selling you something else. We'd rather tell you which two are worth your quarter.`,
  },
  {
    n: 5, title: "Diligence deaths", archetype: "teardown", tag: "li-kt-05",
    cta: "Four questions, then see who fits your raise:",
    body: `The deals that hurt aren't the cold nos. They're the ones that die in diligence.

Cap table. Financial hygiene. Governance.

Not the market, not the team, not the traction — the discoverable stuff. Six weeks in, with a fund that was genuinely interested, after you've stopped talking to everyone else.

Every one of those is findable in an afternoon before you go out.

Nobody does it, because looking for reasons your deal might die feels like the opposite of raising. It's the highest-return afternoon of the whole process.`,
  },
  {
    n: 6, title: "Saying no", archetype: "named_ask", tag: "li-kt-06",
    cta: "Short list or no list, you'll know in under a minute:",
    body: `We tell founders no more often than we tell them yes, and we tell them why.

A company at the wrong stage for our network gets told that, not queued into a list padded out to look generous.

Short lists are the honest outcome of real criteria. Nine matched investors beats forty names where thirty-one were never going to read it.

The founders who take that badly usually go and get the long list somewhere else. The ones who don't tend to raise.`,
  },
  {
    n: 7, title: "Graduation rates", archetype: "teardown", tag: "li-kt-07",
    cta: "Stop spending months on investors who were never going to write it:",
    body: `Seed-to-Series A graduation has fallen from 30.6% to 15.4%.

That's Carta's data. Half the odds, same runway.

The practical effect isn't that raising got harder in some general sense. It's that the cost of a wasted month went up, and most founders haven't adjusted.

Twenty meetings with wrong-fit investors used to be an expensive mistake. At current graduation rates it's most of your window.`,
  },
  {
    n: 8, title: "Investor ceiling", archetype: "named_ask", tag: "li-kt-08",
    cta: "Four questions and you'll see who's still reading:",
    body: `Every investor in our network sets their own monthly limit, and we hold to it even when a founder's list comes up short.

It's a strange thing to build. It means telling a paying founder we can't send to more people this month.

But the alternative is a network that stops opening our emails — and then nobody's materials get read, including the next founder's.

The list is only worth what the people on it are still willing to receive.`,
  },
  {
    n: 9, title: "Sixteen years", archetype: "proof_case", tag: "li-kt-09",
    cta: "Sixteen years of criteria data, four questions:",
    body: `Sixteen years placing companies in front of investors. The software is the part that's new.

One founder came to us after trying five other firms to reach investors. He rated us the best of the five — which mostly tells you what the other four were like.

Another ended up in advanced conversations with several investment partners he'd never previously contacted.

Those came from the practice, not the platform. iCapOS is that process written down and made repeatable — the network and the criteria data behind it are sixteen years old.`,
  },
  {
    n: 10, title: "Four reasons, two fixable", archetype: "teardown", tag: "li-kt-10",
    cta: "The two fixable ones start here:",
    body: `Four reasons founders get rejected. We can only help with two.

Supply and demand is arithmetic. We can't touch it.

Trust deficit narrows with a rating and structured materials, but cold contact still starts at zero and most cheques still come through warm networks. Partly addressable at best.

Thesis mismatch and readiness failures are the two that actually move — and between them they account for most of what kills a raise.

That's the whole thesis. If a platform tells you it fixes all four, ask which one it's lying about.`,
  },
];
