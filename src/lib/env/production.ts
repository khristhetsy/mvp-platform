export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function assertPublicSupabaseEnvConfigured() {
  const { configured } = getPublicSupabaseEnv();
  if (!configured && isProductionEnvironment()) {
    throw new Error("Supabase public environment variables are not configured.");
  }
  return configured;
}
