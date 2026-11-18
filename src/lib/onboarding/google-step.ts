export const GOOGLE_STEP_PATH = "/onboarding/google";

/** Only brand new founder and investor accounts are offered the step, and only
 *  when they were not already headed somewhere specific (an invite, a booking). */
export function shouldOfferGoogleStep(input: { isNewProfile: boolean; role: string; next?: string | null }): boolean {
  if (!input.isNewProfile || input.next) return false;
  return input.role === "founder" || input.role === "investor";
}

/** Where the person goes once they connect or skip. */
export function afterGoogleStepPath(role: string): string {
  return role === "investor" ? "/investor/onboarding" : "/founder/onboarding";
}
