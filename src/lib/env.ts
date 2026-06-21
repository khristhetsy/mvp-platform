/**
 * CapitalOS environment helpers — server-side only.
 * Never import service-role accessors from client components.
 */

export type AppEnv = "local" | "staging" | "production";

const REQUIRED_PUBLIC = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

const REQUIRED_SERVER = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

const OPTIONAL_INTEGRATIONS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "TOKEN_ENCRYPTION_SECRET",
  "RESEND_API_KEY",
  "CLOUDCONVERT_API_KEY",
] as const;

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Explicit APP_ENV wins; otherwise infer from Vercel / Node. */
export function getAppEnv(): AppEnv {
  const explicit = trimEnv("APP_ENV")?.toLowerCase();
  if (explicit === "local" || explicit === "staging" || explicit === "production") {
    return explicit;
  }

  const vercelEnv = trimEnv("VERCEL_ENV");
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "staging";

  if (process.env.NODE_ENV === "development") return "local";

  // Local `next build` / `next start` without APP_ENV — treat as local unless on Vercel production.
  return "local";
}

export function isProductionAppEnv(): boolean {
  return getAppEnv() === "production";
}

export function isStagingAppEnv(): boolean {
  return getAppEnv() === "staging";
}

export function isLocalAppEnv(): boolean {
  return getAppEnv() === "local";
}

/** @deprecated Prefer getAppEnv() === "production". Kept for existing imports. */
export function isProductionEnvironment(): boolean {
  return isProductionAppEnv();
}

export function getPublicSupabaseEnv() {
  const url = trimEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = trimEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function getSupabaseProjectHost(): string | null {
  const { url } = getPublicSupabaseEnv();
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function getAppUrl(): string | null {
  return (
    trimEnv("NEXT_PUBLIC_APP_URL") ??
    trimEnv("NEXT_PUBLIC_SITE_URL") ??
    (trimEnv("VERCEL_URL") ? `https://${trimEnv("VERCEL_URL")}` : null)
  );
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(trimEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

/** Resend transactional email key (optional — features degrade without it). */
export function getResendApiKey(): string | null {
  return trimEnv("RESEND_API_KEY") ?? null;
}

/** CloudConvert key for DOCX→PDF conversion (optional — .docx upload degrades without it). */
export function getCloudConvertApiKey(): string | null {
  return trimEnv("CLOUDCONVERT_API_KEY") ?? null;
}

export type EnvValidationResult = {
  ok: boolean;
  appEnv: AppEnv;
  missing: string[];
  warnings: string[];
};

export function validateRequiredEnv(): EnvValidationResult {
  const appEnv = getAppEnv();
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_PUBLIC) {
    if (!trimEnv(key)) missing.push(key);
  }

  if (appEnv !== "local") {
    for (const key of REQUIRED_SERVER) {
      if (!trimEnv(key)) missing.push(key);
    }
  }

  const prodHostWarning = warnIfProductionSupabaseInLocal();
  if (prodHostWarning) warnings.push(prodHostWarning);

  if (appEnv === "production" && !trimEnv("NEXT_PUBLIC_APP_URL") && !trimEnv("NEXT_PUBLIC_SITE_URL")) {
    warnings.push("Set NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_SITE_URL) in production for OAuth redirects and links.");
  }

  const tokenSecret = trimEnv("TOKEN_ENCRYPTION_SECRET");
  if (tokenSecret && tokenSecret.length < 32) {
    warnings.push("TOKEN_ENCRYPTION_SECRET should be at least 32 characters.");
  }

  return { ok: missing.length === 0, appEnv, missing, warnings };
}

export function assertPublicSupabaseEnvConfigured() {
  const { configured } = getPublicSupabaseEnv();
  if (!configured && isProductionAppEnv()) {
    throw new Error("Supabase public environment variables are not configured.");
  }
  return configured;
}

/** Block destructive or live-only operations outside production APP_ENV. */
export function assertProductionOnlyAction(actionName: string) {
  if (!isProductionAppEnv()) {
    throw new Error(`${actionName} is only permitted when APP_ENV=production (current: ${getAppEnv()}).`);
  }
}

export function warnIfProductionSupabaseInLocal(): string | null {
  if (!isLocalAppEnv()) return null;

  const currentHost = getSupabaseProjectHost();
  if (!currentHost) return null;

  const prodHost =
    trimEnv("CAPITALOS_PRODUCTION_SUPABASE_HOST") ??
    (trimEnv("CAPITALOS_PRODUCTION_SUPABASE_URL")
      ? hostFromUrl(trimEnv("CAPITALOS_PRODUCTION_SUPABASE_URL")!)
      : null);

  if (prodHost && currentHost === prodHost) {
    return `Local development is pointed at the production Supabase host (${currentHost}). Use a separate dev/staging project.`;
  }

  return null;
}

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/** Safe summary for admin UI — no secrets. */
export function getEnvironmentStatusSummary() {
  const validation = validateRequiredEnv();
  const { configured: supabasePublicConfigured } = getPublicSupabaseEnv();

  return {
    appEnv: validation.appEnv,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: trimEnv("VERCEL_ENV") ?? null,
    appUrl: getAppUrl(),
    supabaseProjectHost: getSupabaseProjectHost(),
    supabasePublicConfigured,
    serviceRoleConfigured: isServiceRoleConfigured(),
    googleOAuthConfigured: Boolean(
      trimEnv("GOOGLE_CLIENT_ID") &&
        trimEnv("GOOGLE_CLIENT_SECRET") &&
        trimEnv("GOOGLE_REDIRECT_URI") &&
        trimEnv("TOKEN_ENCRYPTION_SECRET"),
    ),
    cronConfigured: Boolean(trimEnv("CRON_SECRET")),
    claudeConfigured: Boolean(trimEnv("ANTHROPIC_API_KEY")),
    resendConfigured: Boolean(trimEnv("RESEND_API_KEY")),
    cloudconvertConfigured: Boolean(trimEnv("CLOUDCONVERT_API_KEY")),
    envValidationOk: validation.ok,
    missingEnvKeys: validation.missing,
    warnings: validation.warnings,
    requiredPublicKeys: [...REQUIRED_PUBLIC],
    optionalIntegrationKeys: [...OPTIONAL_INTEGRATIONS],
  };
}

export type EnvironmentStatusSummary = ReturnType<typeof getEnvironmentStatusSummary>;
