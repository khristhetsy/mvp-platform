// Pre-publish exposure gate (§1). AEO drives crawlers at the site and they cache
// what they find, so two known exposures must be resolved BEFORE any AEO page is
// published — otherwise we amplify them. This is a hard gate, not a nice-to-have.
//
// Each blocker is an explicit admin attestation persisted in aeo_settings, and
// defaults to UNRESOLVED (blocking). An admin flips it only after fixing the real
// exposure, and that flip is recorded with their id. No automated "all clear."

import { getSettings } from "./store";

export interface ExposureBlocker {
  id: "deal_names" | "security_page";
  label: string;
  detail: string;
  resolved: boolean;
}

export interface ExposureResult {
  ok: boolean;
  blockers: ExposureBlocker[];
}

export async function runExposureCheck(): Promise<ExposureResult> {
  const s = await getSettings();
  const blockers: ExposureBlocker[] = [
    {
      id: "deal_names",
      label: "Real portfolio-company names off public deal cards",
      detail: "Public deal cards must not expose real portfolio-company names (confidentiality + securities risk) before crawlers cache them.",
      resolved: s.deal_names_masked,
    },
    {
      id: "security_page",
      label: "Draft /security page not publicly indexable",
      detail: "The draft /security page must be noindexed (or finalized) so crawlers do not cache an unfinished trust page.",
      resolved: s.security_page_noindexed,
    },
  ];
  return { ok: blockers.every((b) => b.resolved), blockers };
}
