import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import type { Database, UserRole } from "@/lib/supabase/types";

const handleI18n = createIntlMiddleware(routing);

/** Edge-safe env reads — mirrors @/lib/env helpers used here without importing that module. */
function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function getPublicSupabaseEnv() {
  const url = trimEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = trimEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

function isProductionEnvironment(): boolean {
  const explicit = trimEnv("APP_ENV")?.toLowerCase();
  if (explicit === "production") return true;
  if (explicit === "local" || explicit === "staging") return false;
  const vercelEnv = trimEnv("VERCEL_ENV");
  if (vercelEnv === "production") return true;
  return false;
}

type WorkspaceZone = "founder" | "investor" | "admin";

const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

const allowedRolesByZone: Record<WorkspaceZone, UserRole[]> = {
  founder: ["founder", "admin", "analyst"],
  investor: ["investor", "admin", "analyst"],
  admin: ["admin", "analyst"],
};

const protectedPageExactPaths = ["/founder", "/investor", "/admin"];
const protectedPagePrefixes = ["/founder/", "/investor/", "/admin/"];
const protectedApiPrefixes = ["/api/founder/", "/api/investor/", "/api/admin/"];

function isKnownRole(role: string | null | undefined): role is UserRole {
  return role === "founder" || role === "investor" || role === "admin" || role === "analyst";
}

function resolveWorkspaceZone(pathname: string): WorkspaceZone | null {
  if (pathname === "/founder" || pathname.startsWith("/founder/")) return "founder";
  if (pathname === "/investor" || pathname.startsWith("/investor/")) return "investor";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname.startsWith("/api/founder/")) return "founder";
  if (pathname.startsWith("/api/investor/")) return "investor";
  if (pathname.startsWith("/api/admin/")) return "admin";
  return null;
}

function shouldProtectPath(pathname: string) {
  return (
    protectedPageExactPaths.includes(pathname) ||
    protectedPagePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Strip locale prefix to get the canonical pathname for auth checks. */
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** Get current locale from pathname, defaulting to defaultLocale. */
function getLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale;
  }
  return routing.defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const apiRequest = isApiRequest(pathname);

  // ── Locale routing (non-API routes only) ──────────────────────────────────
  if (!apiRequest) {
    const i18nResponse = handleI18n(request);
    // If next-intl is redirecting (e.g. / → /en/), return immediately.
    if (i18nResponse.headers.get("location")) {
      return i18nResponse;
    }
  }

  // ── Auth protection ───────────────────────────────────────────────────────
  // Strip locale prefix to determine the protected zone.
  const authPathname = apiRequest ? pathname : stripLocale(pathname);
  const locale = apiRequest ? routing.defaultLocale : getLocale(pathname);

  if (!shouldProtectPath(authPathname)) {
    // Not a protected path — pass through (intl middleware already ran above).
    return NextResponse.next({ request });
  }

  const zone = resolveWorkspaceZone(authPathname);
  if (!zone) {
    return NextResponse.next({ request });
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, configured } = getPublicSupabaseEnv();

  if (!configured) {
    if (isProductionEnvironment()) {
      if (apiRequest) {
        return jsonError(503, "Authentication service is not configured.");
      }
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/configuration-error`;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (apiRequest) {
      return jsonError(401, "Authentication required.");
    }
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/sign-in`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role?.toLowerCase();

  if (!isKnownRole(role)) {
    if (apiRequest) {
      return jsonError(403, "Profile not found.");
    }
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/sign-in`;
    url.searchParams.set("next", pathname);
    url.searchParams.set("error", "profile_required");
    return NextResponse.redirect(url);
  }

  const allowedRoles = allowedRolesByZone[zone];
  if (!allowedRoles.includes(role)) {
    if (apiRequest) {
      return jsonError(403, "Insufficient permissions.");
    }
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${dashboardByRole[role]}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except _next internals, static files, and images
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sitemap|robots).*)",
  ],
};
