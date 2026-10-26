/**
 * iCapOS client stories page (/clients): founder spotlights, each in the
 * founder's own words from a recorded customer interview.
 *
 * Rules (same as founder-results.ts, FTC 16 CFR Part 255 and Part 465):
 *   - quotes are the founder's own words, trimmed for length and readability only
 *   - approvedOn is the date the founder gave permission to publish (their written
 *     reply, or permission given on the recording). A story renders only while
 *     approvedOn is set, so an entry can be drafted here and stay hidden.
 *   - photo and logo are the founder's own files, supplied by iCFO, kept in
 *     public/marketing/clients. Confirm the founder agreed to their use.
 *   - numbers come from the interview or from company_readiness_scores; never
 *     estimate a figure the founder did not give
 */

export type StoryCard = { eyebrow: string; title: string; body: string[] };
export type StoryQuote = { text: string; attribution: string };
export type SnapshotRow = { label: string; before: string; after: string };

export type ClientStory = {
  slug: string;
  name: string;
  title: string;
  company: string;
  photoUrl: string;
  logoUrl?: string;
  approvedOn: string;
  headline: string;
  summary: string;
  /** Capital Readiness Rating; crrStart is omitted when the founder gave no number. */
  crrStart?: number;
  crrCurrent: number;
  /** Weeks the founder says it took to reach crrCurrent. */
  weeksToScore: number;
  /** Likelihood to recommend, 0 to 10, as the founder answered. */
  recommendScore: number;
  stats: { value: string; label: string }[];
  storyTitle: string;
  story: StoryCard[];
  pullQuotes: StoryQuote[];
  snapshot: SnapshotRow[];
  note?: { title: string; body: string };
};

/** The strip of totals across stories shows only once this many are approved. */
export const MIN_STORIES_FOR_SUMMARY = 3;

export const clientStoriesCopy = {
  metaTitle: "Client stories | iCapOS",
  metaDescription:
    "Hear from founders using iCapOS. Cynthia McBreen of Impervitex Corp. raised her Capital Readiness Rating from 34 to 91 in about three weeks.",
  hero: {
    eyebrow: "Client stories",
    title: "Founders who walked into investor conversations ready.",
    sub: "Real founders, real documents, real results. Here is what happens when your Capital Readiness Rating goes up and your due diligence questions get answered before an investor asks them.",
  },
  spotlightLabel: "Founder spotlight",
  snapshotHeading: "Snapshot",
  quoteNote:
    "Quotes are the founders' own words from recorded interviews, trimmed for length and readability only.",
  cta: {
    title: "See where your Capital Readiness Rating starts.",
    sub: "Load your documents, read the diagnostics, and fix risks before an investor finds them.",
    label: "Get started",
    href: "/start",
  },
  disclaimer:
    "Testimonials reflect individual clients' experiences and are shared with their permission. Results vary. iCapOS is a software platform and does not raise capital or guarantee funding. iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.",
};

export const clientStories: ClientStory[] = [
  {
    slug: "cynthia-mcbreen",
    name: "Cynthia McBreen",
    title: "Founder, CEO & Lead Inventor",
    company: "Impervitex Corp.",
    photoUrl: "/marketing/clients/cynthia-mcbreen.jpg",
    logoUrl: "/marketing/clients/impervitex-logo.png",
    approvedOn: "2026-10-23",
    headline:
      "This is the most support I've ever experienced. This can produce the most optimum outcome for funding.",
    summary:
      "Cynthia is building a deep tech company that is hard to explain to traditional investors. Using iCapOS, she turned a low starting rating into a data room she is proud to put in front of investors.",
    crrStart: 34,
    crrCurrent: 91,
    weeksToScore: 3,
    recommendScore: 10,
    stats: [
      { value: "34 to 91", label: "Capital Readiness Rating in about 3 weeks" },
      { value: "1 month", label: "for work she estimates would take three to four months on her own" },
      { value: "10/10", label: "likelihood to recommend iCapOS to another founder" },
    ],
    storyTitle: "From confused investors to a due diligence report that does the talking.",
    story: [
      {
        eyebrow: "The challenge",
        title: "Hard to explain, easy to lose.",
        body: [
          "Investors from stable industries like real estate did not follow her deep tech business. “Anyone who's confused doesn't get involved in anything financial,” she says.",
          "Many angel investors also would not sign an NDA, which stalled the conversation before it began.",
        ],
      },
      {
        eyebrow: "What changed",
        title: "One risk at a time.",
        body: [
          "Her first rating was 34, and she could not get it to 65. She read the platform's diagnostics, built a checklist, and worked through each risk.",
          "The due diligence report became her key driver because it puts every document in one list, the way an investor reviews them.",
        ],
      },
      {
        eyebrow: "The result",
        title: "A rating of 91 and a plan for the hard questions.",
        body: [
          "iCapOS flagged gaps she had not considered, including a business continuity plan that protects investors if something happens to the founder. She uploaded it and says it was “a huge relief.”",
          "She now studies a list of likely investor questions so she is ready for each one.",
        ],
      },
    ],
    pullQuotes: [
      {
        text: "It would have taken me probably close to three or four months to do the work I just did in a month.",
        attribution: "Cynthia McBreen, Impervitex Corp.",
      },
      {
        text: "It basically answers all the questions that an investor could possibly ask upfront.",
        attribution: "Cynthia McBreen, Impervitex Corp.",
      },
    ],
    snapshot: [
      { label: "Capital Readiness Rating", before: "34, stuck below 65", after: "91 in about 3 weeks" },
      { label: "Time to build the data room", before: "Three to four months, her own estimate", after: "About one month" },
      { label: "Diligence documents", before: "Gaps she had not considered", after: "One list, in the order an investor reviews them" },
      { label: "Investor conversations", before: "Confused investors, many unwilling to sign an NDA", after: "A prepared list of likely questions to study" },
    ],
    // Company details come from Cynthia's media kit, not the recorded interview.
    note: {
      title: "About Impervitex.",
      body: "Impervitex is a Phoenix based deep tech materials company replacing PFAS “forever chemicals” in protective fabric with a single programmable coating. It licenses its automated coating machines to textile mills for a setup fee plus a per meter royalty, is a SAM.gov registered federal contractor, and is in queue for a field test with the U.S. Army DEVCOM. The company is raising a pre seed round.",
    },
  },
  {
    // Interview recorded 2026-10-26. Hidden until approvedOn is set. Confirm title,
    // company and the one sentence quote wording with Dorrin before setting it.
    slug: "dorrin-prophet",
    name: "Dorrin Prophet",
    title: "Founder",
    company: "One Vertical Tier",
    photoUrl: "/marketing/clients/dorrin-prophet.jpg",
    approvedOn: "",
    headline:
      "If you are an entrepreneur founder and need to build capital resources, they are a one-stop shop.",
    summary:
      "Dorrin knew the product market fit but had little to no knowledge of capital readiness. Using iCapOS, Dorrin learned what investors review, rebuilt the materials, and reached a readiness score of 90.",
    crrCurrent: 90,
    weeksToScore: 1,
    recommendScore: 10,
    stats: [
      { value: "About 1 week", label: "to reach a Capital Readiness score of 90, at roughly 5 to 6 hours a day" },
      { value: "None to under 10", label: "investor views after structuring outreach on the platform" },
      { value: "10/10", label: "likelihood to recommend iCapOS to another founder" },
    ],
    storyTitle: "From endless searching to a scoring model that shows the way.",
    story: [
      {
        eyebrow: "The challenge",
        title: "No map to the money.",
        body: [
          "Before iCapOS, Dorrin lacked resources and did not know where to find funding. That meant Google searches and long stretches of browsing LinkedIn.",
          "Investor readiness was not being assessed at all.",
        ],
      },
      {
        eyebrow: "What changed",
        title: "The whole process, made visible.",
        body: [
          "iCapOS tied Dorrin to a pool of resources with structured evidence, documentation, due diligence steps and a scoring model. Where the score showed a gap, Dorrin went back and retooled the information.",
          "Dorrin learned what goes into readiness: the data room, cap table, business plan, pitch and financial models. Seeing every phase from start to finish is what made it click. Legal counsel joined multiple calls to validate the steps.",
        ],
      },
      {
        eyebrow: "The result",
        title: "A score of 90 and a shared language with investors.",
        body: [
          "The first score was below the threshold to even approach investors. After about a week of focused work, Dorrin reached 90.",
          "The Investor Fit Score shows whether a founder is speaking the language of the stage, whether pre seed, seed or Series A. Pre seed investors, for example, want the story of how the idea comes to life.",
        ],
      },
    ],
    pullQuotes: [
      {
        text: "Now, absolutely, I can speak to it almost with my eyes closed.",
        attribution: "Dorrin Prophet, on capital readiness",
      },
      {
        text: "Everyone was responsive within 24 to 48 hours.",
        attribution: "Dorrin Prophet, on the iCFO team",
      },
    ],
    snapshot: [
      { label: "Capital readiness", before: "Little to no knowledge", after: "Score of 90 after about a week" },
      { label: "Finding investors", before: "Google and LinkedIn searches", after: "Structured outreach, with fit scores" },
      { label: "Investor views", before: "None", after: "Just under 10" },
      { label: "Referrals", before: "None", after: "Dorrin now refers other founders to iCapOS" },
    ],
    note: {
      title: "A realistic view of investor outreach.",
      body: "Dorrin is clear that preparation alone does not guarantee attention. Getting a venture investor to view a pitch is a very small threshold, which Dorrin puts at under 1% of the pitches they see. Readiness improves your odds. It does not replace the math.",
    },
  },
  {
    // Interview recorded 2026-10-26. Hidden until approvedOn is set. Confirm title and
    // company (taken from the Global HealthCare Magazine cover, August 2025) and use a
    // headshot Vincent has cleared, not the magazine crop, before setting it.
    slug: "vincent-njoku",
    name: "Vincent Njoku",
    title: "Founder & CEO",
    company: "NutriFlex AI LLC",
    photoUrl: "/marketing/clients/vincent-njoku.jpg",
    approvedOn: "",
    headline: "A fundraising preparation and investor matching platform.",
    summary:
      "Vincent's AI healthcare and wellness company needed investors who understood long development cycles. iCapOS showed where the fundraising materials fell short and which investors to approach first.",
    crrCurrent: 84,
    weeksToScore: 1,
    recommendScore: 10,
    stats: [
      { value: "60s to 84%", label: "Capital Readiness Rating, in about one week" },
      { value: "4 of 10", label: "investors opened the first outreach, a 40% open rate" },
      { value: "10/10", label: "likelihood to recommend iCapOS to another founder" },
    ],
    storyTitle: "From a hunch about readiness to a score and a shortlist.",
    story: [
      {
        eyebrow: "The challenge",
        title: "The right investors, a longer road.",
        body: [
          "Vincent's biggest obstacle was finding investors who understood both AI and the longer development cycles of healthcare and wellness. As a pre revenue company, the team also had to show traction while finishing the product and preparing for research validation.",
          "They had reviewed their own deck, projections, market, roadmap, traction and leadership team, but wanted a structured outside view of the gaps.",
        ],
      },
      {
        eyebrow: "What changed",
        title: "Gaps first, then the deck.",
        body: [
          "The investor readiness assessment was the most useful tool. It identified gaps and set priorities for the pitch deck, financial projections and funding strategy.",
          "Vincent studied the platform and completed each assigned task on time. The readiness rating moved from the 60s to 84% in about a week.",
        ],
      },
      {
        eyebrow: "The result",
        title: "Outreach with more focus.",
        body: [
          "Investor Fit Scores of 80% and 88% helped the team be more selective, prioritizing investors whose sector interest, funding stage and investment size match the company.",
          "Of 10 investors contacted, 4 opened the message. Having readiness and fit in one place also organized the process and cut manual research.",
        ],
      },
    ],
    pullQuotes: [
      {
        text: "The readiness assessment and investor fit tools have helped bring more structure to our fundraising.",
        attribution: "Vincent Njoku, on why the rating is a 10",
      },
      {
        text: "It helped me focus our fundraising efforts because it streamlined the whole thing for us.",
        attribution: "Vincent Njoku, on ease of use",
      },
    ],
    snapshot: [
      { label: "Readiness assessment", before: "Internal review of deck and projections", after: "Structured assessment with prioritized gaps" },
      { label: "Capital Readiness Rating", before: "In the 60s", after: "84% in about one week" },
      { label: "Investor targeting", before: "Hard to reach investors who understood AI and healthcare", after: "Fit scores by sector, stage and check size" },
      { label: "First outreach", before: "No verified baseline", after: "10 contacted, 4 opened" },
    ],
    note: {
      title: "Early days, and honest about it.",
      body: "Vincent does not have a verified before and after count and has not tracked hours saved. The next measure of success is turning that preparation into introductions, responses and meetings. iCFO has proposed an AI agent that answers investor questions the moment a message is opened.",
    },
  },
];

/** True only for a real calendar date written as YYYY-MM-DD, so a placeholder never publishes a story. */
export function isIsoDate(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function storyApproved(s: ClientStory): boolean {
  return Boolean(isIsoDate(s.approvedOn) && s.headline?.trim() && s.name?.trim());
}

/** Stories ready to publish, in the order they are listed above. */
export function approvedStories(list: ClientStory[] = clientStories): ClientStory[] {
  return list.filter(storyApproved);
}

export type StoriesSummary = {
  total: number;
  ratedTen: number;
  crrMin: number;
  crrMax: number;
  weeksMin: number;
  weeksMax: number;
};

/** Totals across approved stories, or null while fewer than the minimum are approved. */
export function storiesSummary(list: ClientStory[] = clientStories): StoriesSummary | null {
  const ready = approvedStories(list);
  if (ready.length < MIN_STORIES_FOR_SUMMARY) return null;
  const crr = ready.map((s) => s.crrCurrent);
  const weeks = ready.map((s) => s.weeksToScore);
  return {
    total: ready.length,
    ratedTen: ready.filter((s) => s.recommendScore === 10).length,
    crrMin: Math.min(...crr),
    crrMax: Math.max(...crr),
    weeksMin: Math.min(...weeks),
    weeksMax: Math.max(...weeks),
  };
}

/** "84 to 91", or a single number when the range collapses. */
export function rangeLabel(min: number, max: number): string {
  return min === max ? String(min) : `${min} to ${max}`;
}
