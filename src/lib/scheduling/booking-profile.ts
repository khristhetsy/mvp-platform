/**
 * Turns a booking's intake answers into CRM profile fields + Membership.
 * Rule: anyone seeking capital is a Founder (Membership "Entrepreneur", module "founder").
 * Investing → Investor. Anything else stays unclassified rather than guessed.
 */
export type BookingAnswer = { label: string; value: string };
export type BookingProfile = {
  membership: "Entrepreneur" | "Investor" | null;
  module: "founder" | "investor" | "unknown";
  /** Stored under raw.__profile.booking. Stage/raise use the same keys as /fit options. */
  booking: Record<string, string>;
};

const find = (answers: BookingAnswer[], re: RegExp) => answers.find((a) => re.test(a.label))?.value?.trim() ?? "";

export function stageKey(v: string): string | null {
  if (/pre.?revenue/i.test(v)) return "pre_revenue";
  if (/series\s*a|beyond|growth/i.test(v)) return "series_a_plus";
  if (/revenue/i.test(v)) return "revenue_pre_a";
  return null;
}
export function raiseKey(v: string): string | null {
  if (/under\s*\$?1\s*m/i.test(v)) return "under_1m";
  if (/over\s*\$?10\s*m/i.test(v)) return "over_10m";
  if (/1\s*m.*10\s*m/i.test(v)) return "1m_10m";
  return null;
}

export function bookingProfile(answers: BookingAnswer[]): BookingProfile {
  const role = find(answers, /raising or investing/i);
  const purpose = `${find(answers, /purpose of this call/i)} ${find(answers, /if other/i)}`;
  const raiseLabel = find(answers, /raise size/i);
  const stageLabel = find(answers, /company stage/i);
  const seeking = /rais/i.test(role) || (!role && /\b(rais(e|ing)|seeking (capital|funding|investment)|looking for (capital|funding|investors))\b/i.test(purpose)) || Boolean(raiseLabel);
  const investing = !seeking && /invest/i.test(role);
  const booking: Record<string, string> = {};
  if (role) booking.role = role;
  if (stageLabel) { booking.stageLabel = stageLabel; const k = stageKey(stageLabel); if (k) booking.stage = k; }
  if (raiseLabel) { booking.raiseLabel = raiseLabel; const k = raiseKey(raiseLabel); if (k) booking.raise = k; }
  const timing = find(answers, /time to close/i);
  if (timing) booking.timeToClose = timing;
  return seeking
    ? { membership: "Entrepreneur", module: "founder", booking }
    : investing
      ? { membership: "Investor", module: "investor", booking }
      : { membership: null, module: "unknown", booking };
}
