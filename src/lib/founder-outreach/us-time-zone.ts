/**
 * The founder's US time zone, from the company's state, for showing when a
 * scheduled email lands ("9:00 AM ET"). States split across two zones use the
 * zone most of their population lives in. Pure, so it is testable.
 */
export type UsZone = { abbr: "ET" | "CT" | "MT" | "PT" | "AKT" | "HT"; iana: string };

const ET: UsZone = { abbr: "ET", iana: "America/New_York" };
const CT: UsZone = { abbr: "CT", iana: "America/Chicago" };
const MT: UsZone = { abbr: "MT", iana: "America/Denver" };
const AZ: UsZone = { abbr: "MT", iana: "America/Phoenix" }; // no daylight saving
const PT: UsZone = { abbr: "PT", iana: "America/Los_Angeles" };
const AK: UsZone = { abbr: "AKT", iana: "America/Anchorage" };
const HI: UsZone = { abbr: "HT", iana: "Pacific/Honolulu" };

const BY_CODE: Record<string, { zone: UsZone; name: string }> = {
  AL: { zone: CT, name: "Alabama" }, AK: { zone: AK, name: "Alaska" }, AZ: { zone: AZ, name: "Arizona" },
  AR: { zone: CT, name: "Arkansas" }, CA: { zone: PT, name: "California" }, CO: { zone: MT, name: "Colorado" },
  CT: { zone: ET, name: "Connecticut" }, DE: { zone: ET, name: "Delaware" }, DC: { zone: ET, name: "District of Columbia" },
  FL: { zone: ET, name: "Florida" }, GA: { zone: ET, name: "Georgia" }, HI: { zone: HI, name: "Hawaii" },
  ID: { zone: MT, name: "Idaho" }, IL: { zone: CT, name: "Illinois" }, IN: { zone: ET, name: "Indiana" },
  IA: { zone: CT, name: "Iowa" }, KS: { zone: CT, name: "Kansas" }, KY: { zone: ET, name: "Kentucky" },
  LA: { zone: CT, name: "Louisiana" }, ME: { zone: ET, name: "Maine" }, MD: { zone: ET, name: "Maryland" },
  MA: { zone: ET, name: "Massachusetts" }, MI: { zone: ET, name: "Michigan" }, MN: { zone: CT, name: "Minnesota" },
  MS: { zone: CT, name: "Mississippi" }, MO: { zone: CT, name: "Missouri" }, MT: { zone: MT, name: "Montana" },
  NE: { zone: CT, name: "Nebraska" }, NV: { zone: PT, name: "Nevada" }, NH: { zone: ET, name: "New Hampshire" },
  NJ: { zone: ET, name: "New Jersey" }, NM: { zone: MT, name: "New Mexico" }, NY: { zone: ET, name: "New York" },
  NC: { zone: ET, name: "North Carolina" }, ND: { zone: CT, name: "North Dakota" }, OH: { zone: ET, name: "Ohio" },
  OK: { zone: CT, name: "Oklahoma" }, OR: { zone: PT, name: "Oregon" }, PA: { zone: ET, name: "Pennsylvania" },
  RI: { zone: ET, name: "Rhode Island" }, SC: { zone: ET, name: "South Carolina" }, SD: { zone: CT, name: "South Dakota" },
  TN: { zone: CT, name: "Tennessee" }, TX: { zone: CT, name: "Texas" }, UT: { zone: MT, name: "Utah" },
  VT: { zone: ET, name: "Vermont" }, VA: { zone: ET, name: "Virginia" }, WA: { zone: PT, name: "Washington" },
  WV: { zone: ET, name: "West Virginia" }, WI: { zone: CT, name: "Wisconsin" }, WY: { zone: MT, name: "Wyoming" },
  PR: { zone: { abbr: "ET", iana: "America/Puerto_Rico" }, name: "Puerto Rico" },
};

const BY_NAME = new Map(Object.values(BY_CODE).map((v) => [v.name.toLowerCase(), v]));

function isUs(country: string | null | undefined): boolean {
  if (!country) return true; // a state with no country is taken as US
  return /^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i.test(country.trim());
}

/** Null when the company isn't in the US or its state isn't recognised. */
export function usZoneForState(
  state: string | null | undefined,
  country?: string | null,
): (UsZone & { stateName: string }) | null {
  if (!state || !isUs(country)) return null;
  const s = state.trim();
  const hit = BY_CODE[s.toUpperCase()] ?? BY_NAME.get(s.toLowerCase());
  return hit ? { ...hit.zone, stateName: hit.name } : null;
}

/** "Mon 28 Sep, 9:00 AM ET" for an instant, in the given zone. */
export function arrivalLabel(instantIso: string, zone: UsZone): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: zone.iana,
  }).formatToParts(new Date(instantIso));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ${zone.abbr}`;
}
