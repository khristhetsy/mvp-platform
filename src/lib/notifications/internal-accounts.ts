/**
 * Staff and test accounts that sit in the founder journey but aren't founders:
 * any @myicfos.com address, and any account whose role isn't founder. Founder
 * nudges skip them.
 */
const INTERNAL_DOMAINS = ["myicfos.com"];

export function isInternalAccount(p: { email: string | null; role?: string | null }): boolean {
  const domain = p.email?.trim().toLowerCase().split("@")[1] ?? "";
  if (INTERNAL_DOMAINS.includes(domain)) return true;
  return Boolean(p.role && p.role.toLowerCase() !== "founder");
}
