/**
 * About page copy — ported VERBATIM from icapos-site-mock.html (spec §6, §13).
 * Known launch gaps (§17): leadership bio slots, illustrative network table,
 * "Est. 2010" inferred from "16 years" — verify against company records.
 */
export const about = {
  hero: {
    eyebrow: "About us",
    title: "Sixteen years of investor relations, now running as software.",
    sub: "iCFO Capital Global has spent sixteen years doing investor relations the manual way — building an investor network, running conferences, and getting companies in front of the right people. iCapOS is that same work, systematized.",
    primaryCta: { label: "Run your free rating", href: "/readiness" },
    secondaryCta: { label: "See our events", href: "/events" },
  },
  statBand: {
    heading: "iCFO Capital Global, Inc.",
    est: "Est. 2010",
    stats: [
      { v: "16 years", k: "Investor relations services" },
      { v: "6,000+ investors", k: "In the iCFO network" },
      { v: "Monthly", k: "Investment conference cadence" },
      { v: "Nationwide", k: "PE Expo series, rotating cities" },
      { v: "Delaware corporation", k: "La Jolla, California" },
    ],
  },
  whatBuilt: {
    eyebrow: "What we've built",
    title: "Three things, built over sixteen years.",
    intro: "iCapOS didn't start as a software idea. It started because the same three assets kept doing the work, and doing them by hand didn't scale.",
    items: [
      { n: "01", h: "Investor relations services", p: "Sixteen years of preparing companies for investor conversations — positioning, materials, financial narrative, and the unglamorous work of getting a company presentable before it goes out." },
      { n: "02", h: "The investor network", p: "More than 6,000+ investors built up relationship by relationship, with mandate criteria on file. Not a purchased list — a network that has stayed responsive because we've never over-mailed it." },
      { n: "03", h: "Investor conferences", p: "A recurring investment conference and an in-person expo series, where companies present directly to investors from that network rather than hoping for a reply to an email." },
    ],
  },
  pillar1: {
    eyebrow: "Pillar one",
    title: "What sixteen years of investor relations actually involved.",
    intro: "Not press releases and shareholder letters. IR at the private-company stage means getting a company to the point where an investor conversation is worth having.",
    items: [
      { tag: "A", h: "Positioning", p: "Turning a founder's explanation of the business into something an investor can evaluate in four minutes — problem, wedge, market, why now." },
      { tag: "B", h: "Materials", p: "Deck, one-pager, and investor update built to the format investors expect, rather than the format the founder happened to build first." },
      { tag: "C", h: "Financial narrative", p: "Model review, assumption pressure-testing, use of proceeds, and runway maths that hold up when someone pushes on them." },
      { tag: "D", h: "Targeting", p: "Deciding which investors to approach and in what order — the judgment call that the matching engine now does at scale." },
    ],
    note: "Why this matters to the product. The Capital Readiness Rating scores the same four areas, in the same order, that this practice worked through by hand. The rubric came out of the engagements, not out of a whiteboard.",
  },
  pillar2: {
    eyebrow: "Pillar two",
    title: "The network is the part that took sixteen years.",
    paras: [
      "Anyone can buy an investor list. What can't be bought is a group of investors who still open the email — and that only survives if you're disciplined about what you send them.",
      "Every investor in the network has mandate criteria on file: sector, stage, check size, geography. Most also set a monthly ceiling on how many companies they're willing to see. We honour those caps even when it means a founder's distribution list comes up short that month, because the alternative is a network that quietly stops reading.",
    ],
    points: [
      "Built relationship by relationship, not acquired or scraped",
      "Mandate criteria recorded and kept current by the investor",
      "Volume caps set by the investor, enforced by the platform",
      "No investor is ever charged, and no list is ever resold",
    ],
    composition: {
      title: "Network composition",
      sub: "Who's actually in it",
      cols: ["Investor type", "Typical mandate"],
      rows: [
        { t: "Individual accredited investors", m: "$25K – $250K" },
        { t: "Angel groups and syndicates", m: "$100K – $1M" },
        { t: "Family offices", m: "$250K – $5M" },
        { t: "Institutional funds", m: "$1M+" },
      ],
      note: "Composition and ranges shown are illustrative of the network's shape. Actual figures to be confirmed before launch.",
    },
  },
  pillar3: {
    eyebrow: "Pillar three",
    title: "The conference is still the highest-signal thing we do.",
    intro: "Distribution gets a company noticed. A room gets it evaluated. We've kept the events unchanged through the platform build for exactly that reason.",
    items: [
      { h: "Live, not recorded", p: "Founders present to investors in real time and take questions from the room. Investors get to push on the answer, which is the whole point." },
      { h: "Recurring, not annual", p: "A monthly cadence means a company that isn't ready this month has a next month, rather than waiting a year for the next window." },
      { h: "Nationwide, not city-by-city", p: "The expo series rotates cities rather than building separate local chapters, so a presenting company reaches the same national network wherever it lands." },
    ],
    cta: { label: "See the event schedule", href: "/events" },
  },
  whyExists: {
    eyebrow: "Why iCapOS exists",
    title: "The service worked. It just didn't scale.",
    paras: [
      "Traditional investor relations is a handful of people doing careful, repetitive work: reading a company, judging whether it's ready, deciding which investors it fits, and making the approach. It's effective, and it's expensive — which meant we could only ever help a small number of companies at a time.",
      "iCapOS encodes the parts that are consistent. The readiness assessment became a structured rating. The investor judgment became a matching engine with fit scores. The outreach became distribution the founder controls. What's left over — the judgment calls, the room, the relationships — is still done by people.",
    ],
    points: [
      "The rating is the assessment we used to do by hand",
      "The matching engine runs on mandate criteria we already held",
      "The conference is unchanged — it just has a bigger front door now",
    ],
  },
  honest: {
    eyebrow: "Honest about the new part",
    title: "Sixteen years of history, one year of software.",
    paras: [
      "The network and the conferences have a long track record. iCapOS itself is new, and we're not going to dress it up as more than that.",
      "We don't publish response-rate or funding-probability figures, because we haven't measured them on iCapOS accounts yet. What we can tell you is what the platform does, what it costs, and what it explicitly doesn't do — which is on every page of this site.",
    ],
    note: "No success fees, ever. The subscription is the entire commercial relationship. We take nothing from what you raise.",
  },
  timeline: {
    eyebrow: "How we got here",
    title: "The short version.",
    items: [
      { when: "The first years", h: "iCFO Capital Global is founded", p: "A Delaware corporation offering investor relations services to private companies preparing to raise." },
      { when: "Building the network", h: "The investor side takes shape", p: "Relationships accumulate into a network with recorded mandate criteria — sector, stage, check size, geography — rather than a static contact list." },
      { when: "The conference era", h: "Investor conferences become the engine", p: "Live presentations prove to be the highest-signal format on both sides, and the conference becomes recurring rather than occasional." },
      { when: "2026", h: "iCapOS launches", p: "The assessment, the matching, and the distribution move into software. The expo series goes nationwide, and founders can now start self-serve instead of waiting for capacity." },
      { when: "Now", h: "Instrumenting the results", p: "Building the cohort data that will let us publish real performance numbers instead of modeled ones." },
    ],
    note: "Milestone dates to be confirmed against company records before launch.",
  },
  offices: {
    eyebrow: "Where we are",
    title: "Nine offices, three continents.",
    sub: "Headquartered in La Jolla, California, with the conference and expo series running across the US, Europe and Asia.",
    cities: ["La Jolla", "Newport Beach", "San Diego", "Beverly Hills", "Scottsdale", "Palm Springs", "St. Louis", "Paris", "Singapore"],
  },
  commitments: {
    eyebrow: "How we operate",
    title: "Four commitments we'd rather be held to.",
    items: [
      { h: "We charge a subscription, not a percentage", p: "No success fees, no carry, no commission on anything that happens after an introduction. Our incentive is that the product works well enough that you keep paying for it." },
      { h: "We protect the investor side first", p: "Investors set their own monthly volume caps, and we honour them even when it means a founder's distribution list comes up short. A network that stops reading is worth nothing to anyone." },
      { h: "We stay out of the transaction", p: "iCapOS is pledge-only. No funds, no subscriptions, no transactions on the platform. We're not a broker-dealer, funding portal, investment adviser, or placement agent, and we don't take transaction-based compensation." },
      { h: "We don't quote numbers we can't stand behind", p: "Where a figure is modeled rather than measured, we say so — or we leave it off the page. When we have instrumented cohort results, they'll be published as results." },
    ],
  },
  leadership: {
    eyebrow: "Leadership",
    title: "Who runs it.",
    people: [
      { initials: "KT", name: "Khris Thetsy", role: "Founder & Chief Executive Officer", bio: "Founded iCFO Capital Global and leads the firm's investor relations practice, the conference series, and the iCapOS product." },
      { initials: "—", name: "Investor Relations", role: "Bio slot", bio: "Runs the investor network, mandate intake, and volume preferences across the conference and platform sides." },
      { initials: "—", name: "Operations", role: "Bio slot", bio: "Runs event delivery, founder onboarding, and the support side of the platform." },
    ],
  },
} as const;
