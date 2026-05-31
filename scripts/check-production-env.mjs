import { loadEnvLocalIfNeeded } from "./lib/load-env.mjs";

loadEnvLocalIfNeeded();

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
}

function present(value) {
  return Boolean(value?.trim());
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

record("NEXT_PUBLIC_SUPABASE_URL", present(supabaseUrl), supabaseUrl ? "set" : "missing");
record("NEXT_PUBLIC_SUPABASE_ANON_KEY", present(anonKey), anonKey ? "set" : "missing");
record("SUPABASE_SERVICE_ROLE_KEY", present(serviceKey), serviceKey ? "set" : "missing");
record("DATABASE_URL (backup scripts)", present(databaseUrl), databaseUrl ? "set" : "missing (optional for app runtime)");

const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();
const tokenSecret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();

record("GOOGLE_CLIENT_ID", present(googleId), googleId ? "set" : "missing");
record("GOOGLE_CLIENT_SECRET", present(googleSecret), googleSecret ? "set" : "missing");
record("GOOGLE_REDIRECT_URI", present(googleRedirect), googleRedirect ?? "missing");
record(
  "TOKEN_ENCRYPTION_SECRET",
  present(tokenSecret) && (tokenSecret?.length ?? 0) >= 32,
  tokenSecret ? `length=${tokenSecret.length}` : "missing",
);

const openai = process.env.OPENAI_API_KEY?.trim();
record("OPENAI_API_KEY (optional)", true, openai ? "set" : "not set");

const isProd =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
const vercelUrl = process.env.VERCEL_URL?.trim() ?? "";

if (isProd) {
  record(
    "Production Supabase public env",
    present(supabaseUrl) && present(anonKey),
    "required in production",
  );
  record("Production service role", present(serviceKey), "required for server operations");
}

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

const redirectHost = googleRedirect ? hostOf(googleRedirect) : null;
const siteHost = siteUrl ? hostOf(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`) : null;
const vercelHost = vercelUrl ? hostOf(vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`) : null;

if (googleRedirect && (siteHost || vercelHost)) {
  const expectedHosts = [siteHost, vercelHost].filter(Boolean);
  const aligned = expectedHosts.some((host) => redirectHost === host);
  record(
    "GOOGLE_REDIRECT_URI host alignment",
    aligned,
    `redirect=${redirectHost ?? "?"} site=${siteHost ?? "n/a"} vercel=${vercelHost ?? "n/a"}`,
  );
} else {
  record(
    "GOOGLE_REDIRECT_URI host alignment",
    true,
    "skipped (set NEXT_PUBLIC_SITE_URL or VERCEL_URL to enforce alignment)",
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
const requiredFailed = failed.filter((row) => !row.name.includes("optional") && !row.name.includes("skipped"));

console.log(JSON.stringify({ ok: requiredFailed.length === 0, isProd, results }, null, 2));
process.exit(requiredFailed.length === 0 ? 0 : 1);
