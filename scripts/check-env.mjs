import { loadEnvLocalIfNeeded } from "./lib/load-env.mjs";

loadEnvLocalIfNeeded();

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
}

function present(value) {
  return Boolean(value?.trim());
}

function trim(name) {
  return process.env[name]?.trim() ?? "";
}

function getAppEnv() {
  const explicit = trim("APP_ENV").toLowerCase();
  if (explicit === "local" || explicit === "staging" || explicit === "production") return explicit;
  const vercel = trim("VERCEL_ENV");
  if (vercel === "production") return "production";
  if (vercel === "preview") return "staging";
  if (process.env.NODE_ENV === "development") return "local";
  return "local";
}

function hostOf(value) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

const appEnv = getAppEnv();
const supabaseUrl = trim("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = trim("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = trim("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = trim("NEXT_PUBLIC_APP_URL") || trim("NEXT_PUBLIC_SITE_URL");

record("APP_ENV", true, appEnv);

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  record(key, present(process.env[key]), present(process.env[key]) ? "set" : "missing");
}

if (appEnv !== "local") {
  record("SUPABASE_SERVICE_ROLE_KEY", present(serviceKey), serviceKey ? "set" : "missing");
} else {
  record("SUPABASE_SERVICE_ROLE_KEY (local optional)", true, serviceKey ? "set" : "not set");
}

record("NEXT_PUBLIC_APP_URL", present(appUrl) || appEnv === "local", appUrl || "not set");

const googleId = trim("GOOGLE_CLIENT_ID");
const googleSecret = trim("GOOGLE_CLIENT_SECRET");
const googleRedirect = trim("GOOGLE_REDIRECT_URI");
const tokenSecret = trim("TOKEN_ENCRYPTION_SECRET");

record("GOOGLE_CLIENT_ID", appEnv === "local" ? true : present(googleId), googleId ? "set" : appEnv === "local" ? "optional locally" : "missing");
record("GOOGLE_CLIENT_SECRET", appEnv === "local" ? true : present(googleSecret), googleSecret ? "set" : appEnv === "local" ? "optional locally" : "missing");
record("GOOGLE_REDIRECT_URI", appEnv === "local" ? true : present(googleRedirect), googleRedirect || (appEnv === "local" ? "optional locally" : "missing"));
record(
  "TOKEN_ENCRYPTION_SECRET",
  appEnv === "local"
    ? !tokenSecret || tokenSecret.length >= 32
    : present(tokenSecret) && tokenSecret.length >= 32,
  tokenSecret
    ? tokenSecret.length >= 32
      ? `length=${tokenSecret.length}`
      : appEnv === "local"
        ? `warning: too short (${tokenSecret.length}, need 32+ for Google OAuth)`
        : `too short (${tokenSecret.length}, need 32+)`
    : appEnv === "local"
      ? "optional locally"
      : "missing",
);

const prodHost =
  trim("CAPITALOS_PRODUCTION_SUPABASE_HOST") || hostOf(trim("CAPITALOS_PRODUCTION_SUPABASE_URL"));
const currentHost = hostOf(supabaseUrl);
if (appEnv === "local" && prodHost && currentHost && prodHost === currentHost) {
  record(
    "Production Supabase guard",
    false,
    `Local APP_ENV uses production Supabase host ${currentHost}`,
  );
} else if (appEnv === "local" && prodHost) {
  record("Production Supabase guard", true, `local host ${currentHost ?? "?"} ≠ prod ${prodHost}`);
} else {
  record(
    "Production Supabase guard",
    true,
    prodHost ? "skipped (not local)" : "skipped (set CAPITALOS_PRODUCTION_SUPABASE_HOST to enable)",
  );
}

if (appEnv === "production") {
  record("Production public Supabase", present(supabaseUrl) && present(anonKey), "required");
  record("Production service role", present(serviceKey), "required");
  record("Production app URL", present(appUrl), "required for OAuth/links");
  record("CRON_SECRET", present(trim("CRON_SECRET")), "required for Vercel cron orchestration");
}

if (appEnv === "staging") {
  record("CRON_SECRET (staging)", present(trim("CRON_SECRET")), present(trim("CRON_SECRET")) ? "set" : "missing");
}

const redirectHost = hostOf(googleRedirect);
const appHost = hostOf(appUrl.startsWith("http") ? appUrl : appUrl ? `https://${appUrl}` : "");
if (googleRedirect && appHost) {
  record(
    "GOOGLE_REDIRECT_URI host alignment",
    redirectHost === appHost,
    `redirect=${redirectHost ?? "?"} app=${appHost ?? "?"}`,
  );
}

if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    record("Supabase URL format", parsed.protocol === "https:", parsed.host);
  } catch {
    record("Supabase URL format", false, "invalid URL");
  }
}

const failed = results.filter((row) => row.pass === false);
const requiredFailed = failed.filter((row) => {
  if (row.name.includes("optional") || row.detail?.includes("skipped")) return false;
  if (appEnv === "local" && row.name === "TOKEN_ENCRYPTION_SECRET" && row.detail?.startsWith("warning:")) {
    return false;
  }
  return true;
});

console.log(JSON.stringify({ ok: requiredFailed.length === 0, appEnv, results }, null, 2));
process.exit(requiredFailed.length === 0 ? 0 : 1);
