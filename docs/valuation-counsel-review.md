# Valuation Studio — securities counsel review request

**To:** [Securities counsel]
**From:** [Name], iCFO Capital Global, Inc.
**Re:** Founder-side valuation feature (iCapOS) — review before enabling; pairs with the marketplace review in progress
**Date:** [Date]

---

This is a request for written guidance on a new iCapOS feature before we enable it. It is closely related to the marketplace posture you are already reviewing, and I'd like the two considered together. This memo is a controls-and-drafting document, not legal advice; it states our intended position and the controls we have already built in code so you can react to something concrete.

## The position we are taking

**iCapOS produces an indicative valuation range from founder-supplied inputs, for the founder's own preparation. It does not value companies, price offerings, or opine on worth.**

The tool runs standard valuation methods (trading comparables and precedent transactions from banker practice; Berkus, Scorecard, and Risk Factor Summation from angel practice; the VC Method; a DCF) against numbers the founder enters, and returns a *range* — never a single number. A separate advisor returns business-improvement suggestions (e.g., "improve retention so the multiple is defensible"); it never recommends a price or a pre-money to raise at.

## The conflict we want your read on

iCFO Capital Global distributes founder materials to its own 6,000+ investor network and arranges introductions. If iCapOS also produced a valuation that reached those investors, iCFO would be generating a price signal for a company it is simultaneously promoting.

Our v1 posture is deliberately narrow to avoid that:

- **Founder-side only, no investor exposure.** The valuation output does not appear on any investor-facing surface — not the profile card, the private market listing, matching, the data room, or the one-pager sent to the network. This is enforced by a feature flag (`valuation_investor_visible`) that defaults to off, and by the absence of any code path on an investor surface that reads valuation data. Turning it on would be your decision, not an engineering one.

## Controls already implemented in code

So the review is concrete, these are live in the build:

1. **Standing disclaimer** on every valuation surface: *"Indicative range generated from founder-supplied inputs for preparation purposes. Not an appraisal, not a fairness opinion, not investment advice, and not an offer to sell or solicit securities. iCFO Capital Global, Inc. does not set or endorse a price for any offering."*
2. **No single number is ever displayed without its range** — enforced in the component, not by convention.
3. **Prohibited-terms linter**, in CI against a shared list (certified, valuation report, appraisal, opinion of value, fairness opinion, 409A, institutional-grade, "your company is worth," guaranteed, and named firms) **and at runtime against the advisor's output** — a banned term triggers one regeneration, then a safe fallback message.
4. **Advisor guardrails**: never states or recommends a price; never predicts investor behavior as certainty; never references specific funds; never suggests raising the number by changing an input rather than the underlying business. Improvement percentages are labeled *modeled*, not measured.
5. **Comparable multiples are clamped** to a reference band (±30%) with source and date shown — a founder cannot enter an arbitrary multiple and have the tool present it as analysis.
6. **No export** in v1. A downloadable document becomes a credential the moment it leaves the platform, so we ship without it.
7. **Full audit record** retained for every generation: inputs, provenance (which fields came from the profile vs. were typed, and whether financials were stale), method outputs, advisor text, model version, and timestamp.

## Questions for written answer

1. Does an indicative range shown **only to the founder**, with the disclaimer above, create any issue given iCFO's distribution and introduction role?
2. What disclosure would be required if a valuation ever became visible to investors on the platform?
3. Does the advisor's improvement guidance — business advice, not securities advice — sit cleanly outside investment advice as framed here?
4. Is the modeled-uplift labeling sufficient, or should the percentages be removed from founder-facing output entirely?
5. Does anything here interact with the pledge-only, no-transactions posture already under review?

We will not enable any investor-facing exposure of valuation data until we have your answer to (1) and (2) in writing. Happy to walk through the tool live or share the build spec and the compliance appendix it was built against.

Thank you,

[Name]
