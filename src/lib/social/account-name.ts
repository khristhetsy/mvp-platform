/** Client-safe: what to call a connected account in the UI — its label if set, else the platform display name. */
export function accountName(a: { label: string | null; display_name: string | null; platform: string }): string {
  return a.label || a.display_name || a.platform;
}
