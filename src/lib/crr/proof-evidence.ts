/**
 * Why each CRR category matters to investors, with the source and population
 * behind every figure. Static reference copy, reviewed by hand.
 *
 * Rules kept here: a figure appears only with its source and population; where
 * no data was found the card says so; nothing links a CRR score itself to a
 * funding outcome.
 */
import type { Dimension } from "@/lib/crr/profiles";

export const SOURCES = {
  vc: { label: "Gompers, Gornall, Kaplan and Strebulaev, VC survey (Harvard Law School Forum summary)", url: "https://corpgov.law.harvard.edu/2019/08/20/how-do-venture-capitalists-make-decisions" },
  nber: { label: "NBER Digest, Dec 2016", url: "https://www.nber.org/digest/dec16/w22587.html" },
  cbi: { label: "CB Insights, startup failure reasons, Mar 2026", url: "https://www.cbinsights.com/research/report/startup-failure-reasons-top/" },
  doc: { label: "DocSend pitch deck research", url: "https://www.dropbox.com/resources/docsend-pitch-deck-research" },
  carta: { label: "Carta, 2026 Founder Ownership Report", url: "https://carta.com/data/founder-ownership-2026-full-report/" },
} as const;

export type SourceKey = keyof typeof SOURCES;

export type Evidence = {
  dimension: Dimension;
  data: string[];
  population: string[];
  why: string;
  gap: string;
  sources: SourceKey[];
};

export const EVIDENCE: Evidence[] = [
  {
    dimension: "narrative",
    data: ["Investors spent over 4 minutes on 2020 pre seed decks that raised money and 1 minute 30 seconds on decks that did not.", "83% of VCs rate the business model as an important selection factor."],
    population: ["DocSend pre seed decks, 2020. The page gives no sample size.", "About 885 institutional VCs, surveyed Nov 2015 to Mar 2016."],
    why: "Funded decks held attention longer, and business model is the slide with the most time on seed decks. A narrative that makes the business model clear is what gets read. This shows association, not cause.",
    gap: "No data found that links a narrative score itself to funding outcomes.",
    sources: ["doc", "vc"],
  },
  {
    dimension: "team",
    data: ["95% of VCs rate the management team as an important selection factor and 47% rate it the most important.", "96% cite the team as a driver of success and 92% as a driver of failure."],
    population: ["About 885 institutional VCs, surveyed Nov 2015 to Mar 2016.", "Same survey. The NBER Digest of the earlier working paper says over 55% ranked team first. The lower published figure is used here."],
    why: "Team is the factor investors name most often, for picking deals and for explaining outcomes. A measured team score speaks to the factor they weigh first.",
    gap: "These are investors' stated views, not measured outcomes.",
    sources: ["vc", "nber"],
  },
  {
    dimension: "financial",
    data: ["70% of failed companies ran out of capital, which CB Insights calls the final cause, not the root problem. 19% had unsustainable unit economics.", "20% of VCs do not forecast cash flows and 9% use no quantitative deal metric."],
    population: ["385 VC backed companies that shut down since 2023, with a cause identified.", "About 885 institutional VCs."],
    why: "Running out of cash is how most failures end, so investors look at runway and unit economics. Most VCs also run quantitative checks, which means weak financials get found in diligence.",
    gap: "No figure found for how much financial strength alone predicts funding. The VC survey does not report financial factors separately.",
    sources: ["cbi", "vc"],
  },
  {
    dimension: "traction",
    data: ["43% of failed companies had poor product market fit, the second most common reason named.", "74% of VCs rate the product and 68% rate the market as important."],
    population: ["385 VC backed companies that shut down since 2023.", "About 885 institutional VCs."],
    why: "Product market fit is a leading named cause of failure, and traction is the visible evidence of it. Traction is therefore the proof investors can check. This step is an inference from the two figures.",
    gap: "The VC survey does not report traction separately, so no share of investors ranking it first was found.",
    sources: ["cbi", "vc"],
  },
  {
    dimension: "capTable",
    data: ["Median founder ownership is about 56% at seed and 36% at Series A.", "VCs are relatively inflexible on valuation, board control, vesting, liquidation preferences, anti dilution and pro rata rights."],
    population: ["Carta customer data, rounds closed 2021 to 2025, US founders, snapshot Jan 1 2026.", "About 885 institutional VCs. The survey gives no percentages for these terms."],
    why: "The terms investors will not move on are set by the cap table. A clean and documented structure is the baseline they price against, and ownership falls by about 20 points between seed and Series A. The 20 point gap is arithmetic on the two Carta figures.",
    gap: "Carta does not analyse whether cap table state predicts fundraising success.",
    sources: ["carta", "vc"],
  },
];
