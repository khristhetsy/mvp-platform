/**
 * Pure: the sign up link behind "Claim my FREE report". Free founder plan, the
 * claim email prefilled, the signed claim token when the page was opened from
 * the lead email, and the partner code when it is an active one.
 */
export function claimSignUpUrl(input: { email: string; claimToken?: string | null; partnerCode?: string | null }): string {
  const params = new URLSearchParams({ role: "founder", plan: "founder_free" });
  const email = input.email.trim();
  if (email) params.set("email", email);
  if (input.claimToken) params.set("claim", input.claimToken);
  if (input.partnerCode) params.set("ref", input.partnerCode);
  return `/auth/sign-up?${params.toString()}`;
}

/** Loose check before sending someone to sign up; sign up validates properly. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
