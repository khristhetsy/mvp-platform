// Prospect Pipeline — Step 3: paid discovery provider adapter (Apollo / Hunter).
// Pluggable and env-gated: with no key it's a no-op, so the free cascade runs
// unchanged and this lights up the moment a key is added to Vercel env. Only
// called as the LAST resort (when free steps still leave a gap), so it never
// burns credits on contacts we could resolve for free.

export interface ProviderResult {
  email: string | null;
  phone: string | null;
  source: "provider";
}

export function providerConfigured(): boolean {
  return Boolean(process.env.HUNTER_API_KEY?.trim() || process.env.APOLLO_API_KEY?.trim());
}

export async function providerLookup(input: { name?: string | null; domain?: string | null }): Promise<ProviderResult | null> {
  const hunter = process.env.HUNTER_API_KEY?.trim();
  const domain = (input.domain ?? "").trim();
  if (!domain) return null;

  // Hunter Email Finder (guarded; not exercised until a key exists).
  if (hunter) {
    try {
      const parts = (input.name ?? "").trim().split(/\s+/);
      const params = new URLSearchParams({ domain, api_key: hunter });
      if (parts[0]) params.set("first_name", parts[0]);
      if (parts.length > 1) params.set("last_name", parts.slice(1).join(" "));
      const res = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
      if (res.ok) {
        const j = (await res.json()) as { data?: { email?: string | null; phone_number?: string | null } };
        return { email: j?.data?.email ?? null, phone: j?.data?.phone_number ?? null, source: "provider" };
      }
    } catch {
      /* provider best-effort */
    }
  }

  // Apollo would slot in here with the same shape.
  return null;
}
