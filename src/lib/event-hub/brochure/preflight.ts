// Event Brochure — data-quality preflight (build spec §6). Blocking-acknowledge
// warnings; generate is allowed with fallbacks but the panel must be seen.

import type { EventMergeData } from "@/lib/event-email/merge";

export type Preflight = {
  warnings: { level: "warn" | "info"; text: string }[];
  excludePresenters: boolean;
};

export function computePreflight(merge: EventMergeData): Preflight {
  const warnings: Preflight["warnings"] = [];

  const noHeadshots = merge.presenters.filter((p) => !p.headshotUrl).length;
  if (merge.presenters.length && noHeadshots) {
    warnings.push({ level: "warn", text: `${noHeadshots} presenter${noHeadshots === 1 ? "" : "s"} missing a headshot — initials fallback will be used.` });
  }

  const allSponsors = [...merge.sponsorTiers.presenting, ...merge.sponsorTiers.track, ...merge.sponsorTiers.community];
  const noLogos = allSponsors.filter((s) => !s.logoUrl).length;
  if (allSponsors.length && noLogos) {
    warnings.push({ level: "warn", text: `${noLogos} sponsor${noLogos === 1 ? "" : "s"} missing a logo — a name placeholder will be used.` });
  }

  if (!merge.sessions.length) {
    warnings.push({ level: "warn", text: "No sessions on the event yet — the agenda page will show a placeholder." });
  }

  if (!merge.timeRange) {
    warnings.push({ level: "info", text: "Event time range not set — the cover and agenda will omit the time." });
  }

  const excludePresenters = merge.presenters.length === 0;
  if (excludePresenters) {
    warnings.push({ level: "info", text: "No approved presenters — the presenters page is auto-excluded." });
  }

  return { warnings, excludePresenters };
}
