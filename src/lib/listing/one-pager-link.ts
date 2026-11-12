/**
 * Who reached out decides whether the One Pager shows the Seeking (Raising) amount.
 * Links a founder sends carry ?src=founder, so the amount shows. Links iCapOS sends
 * (automation, introduction requests) have no marker, so the amount is hidden.
 * SPV clients always show it. The marker is only a hint in the link, not a secret.
 */
export const ONE_PAGER_SOURCE_PARAM = "src";
export const ONE_PAGER_FOUNDER_SOURCE = "founder";

/** Path of a company's One Pager as a founder shares it. */
export function founderOnePagerPath(slug: string): string {
  return `/f/${slug}?${ONE_PAGER_SOURCE_PARAM}=${ONE_PAGER_FOUNDER_SOURCE}`;
}

/** True when the One Pager shows the Seeking amount for this visit. */
export function showSeekingAmount(input: {
  isSpv: boolean;
  source: string | string[] | null | undefined;
}): boolean {
  if (input.isSpv) return true;
  const value = Array.isArray(input.source) ? input.source[0] : input.source;
  return value === ONE_PAGER_FOUNDER_SOURCE;
}
