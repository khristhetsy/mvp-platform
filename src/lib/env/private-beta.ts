/**
 * Private beta mode — server-side. Set PRIVATE_BETA_MODE=true in deployment env.
 * For client UI copy/banners, also set NEXT_PUBLIC_PRIVATE_BETA_MODE=true.
 */
export function isPrivateBetaMode(): boolean {
  const server = process.env.PRIVATE_BETA_MODE?.trim().toLowerCase();
  if (server === "true" || server === "1") return true;
  if (server === "false" || server === "0") return false;

  const client = process.env.NEXT_PUBLIC_PRIVATE_BETA_MODE?.trim().toLowerCase();
  return client === "true" || client === "1";
}

export function getPrivateBetaModeLabel(): string {
  return isPrivateBetaMode() ? "Private Beta" : "Standard";
}
