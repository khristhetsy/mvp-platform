/**
 * iCapOS client stories page (/clients): one founder spotlight, in the founder's
 * own words from a recorded customer interview.
 *
 * Rules (same as founder-results.ts, FTC 16 CFR Part 255 and Part 465):
 *   - quotes are the founder's own words, trimmed for length and readability only
 *   - approvedOn is the date the founder gave permission on the recording
 *   - photo and logo are the founder's own files, supplied by iCFO, kept in
 *     public/marketing/clients. Confirm she agreed to their use before publishing.
 *   - the spotlight renders only while approvedOn is set
 */

export type ClientSpotlight = {
  name: string;
  title: string;
  company: string;
  photoUrl: string;
  logoUrl: string;
  approvedOn: string;
  headline: string;
  summary: string;
  crrStart: number;
  crrCurrent: number;
  stats: { value: string; label: string }[];
  story: { eyebrow: string; title: string; body: string }[];
  pullQuotes: string[];
};

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
  storyEyebrow: "Cynthia's story",
  storyTitle: "From confused investors to a due diligence report that does the talking.",
  cta: {
    title: "See where your Capital Readiness Rating starts.",
    sub: "Load your documents, read the diagnostics, and fix risks before an investor finds them.",
    label: "Get started",
    href: "/start",
  },
  disclaimer:
    "Testimonials reflect one client's individual experience and are shared with her permission. Results vary. iCapOS is a software platform and does not raise capital or guarantee funding. iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.",
};

export const clientSpotlight: ClientSpotlight = {
  name: "Cynthia McBreen",
  title: "Owner",
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
  stats: [
    { value: "About 3 weeks", label: "to move her Capital Readiness Rating from 34 to 91" },
    { value: "1 month", label: "for work she estimates would take three to four months on her own" },
    { value: "10/10", label: "likelihood to recommend iCapOS to another founder" },
  ],
  story: [
    {
      eyebrow: "The challenge",
      title: "Hard to explain, easy to lose.",
      body: "Investors from stable industries like real estate did not follow her deep tech business. “Anyone who's confused doesn't get involved in anything financial,” she says. Many angel investors also would not sign an NDA, which stalled the conversation before it began.",
    },
    {
      eyebrow: "What changed",
      title: "One risk at a time.",
      body: "Her first rating was 34, and she could not get it to 65. She read the platform's diagnostics, built a checklist, and worked through each risk. The due diligence report became her key driver because it puts every document in one list, the way an investor reviews them.",
    },
    {
      eyebrow: "The result",
      title: "A rating of 91 and a plan for the hard questions.",
      body: "iCapOS flagged gaps she had not considered, including a business continuity plan that protects investors if something happens to the founder. She uploaded it and says it was “a huge relief.” She now studies a list of likely investor questions so she is ready for each one.",
    },
  ],
  pullQuotes: [
    "It would have taken me probably close to three or four months to do the work I just did in a month.",
    "It basically answers all the questions that an investor could possibly ask upfront.",
  ],
};

export function spotlightApproved(s: ClientSpotlight = clientSpotlight): boolean {
  return Boolean(s.approvedOn?.trim() && s.headline?.trim() && s.name?.trim());
}
