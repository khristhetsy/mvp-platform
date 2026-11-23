/**
 * Open as founder access: pure rules, no server imports, so they can be unit tested.
 *
 * While a staff member acts as a founder, each department has a switch per founder menu
 * item and per account action. A switch that is on lets staff in that department do it,
 * overriding the founder's own switches, stage and plan locks, quotas and guards. A switch
 * with no saved row is ON, so a new menu item opens by default and release changes nothing.
 */

/** Account actions that are not menu pages. */
export const ACTING_ACCOUNT_KEY = "acting:account";
export const ACTING_TERMS_KEY = "acting:terms";
export const ACTING_PAYMENTS_KEY = "acting:payments";
export const ACTING_CREDENTIALS_KEY = "acting:credentials";
export const ACTING_CONNECTIONS_KEY = "acting:connections";

/** Menu item keys are the founder menu hrefs. Social media is the one the routes use directly. */
export const ACTING_SOCIAL_KEY = "/founder/deploy/social";
export const ACTING_OUTREACH_KEY = "/founder/deploy";

export const ACTING_ACCOUNT_ITEMS: ReadonlyArray<{ key: string; label: string; note: string }> = [
  { key: ACTING_ACCOUNT_KEY, label: "View and edit the founder account", note: "Profile, company, team and notifications" },
  { key: ACTING_TERMS_KEY, label: "Accept terms, sign agreements, give consent", note: "Recorded under the founder's name" },
  { key: ACTING_PAYMENTS_KEY, label: "Payment methods and billing", note: "" },
  { key: ACTING_CREDENTIALS_KEY, label: "Change password or email", note: "" },
  { key: ACTING_CONNECTIONS_KEY, label: "Connect LinkedIn, Google and other accounts", note: "" },
];

export type FounderAccessRow = { department_id: string; item_key: string; enabled: boolean };

/**
 * May staff in these departments use this item while acting?
 * - No departments (unassigned staff): yes, the same rollout safe rule departments already use.
 * - Otherwise yes unless EVERY one of their departments has an explicit off switch for it.
 */
export function founderAccessGranted(rows: ReadonlyArray<FounderAccessRow>, departmentIds: ReadonlyArray<string>, itemKey: string): boolean {
  if (departmentIds.length === 0) return true;
  return departmentIds.some((id) => {
    const row = rows.find((r) => r.department_id === id && r.item_key === itemKey);
    return row ? row.enabled : true;
  });
}
