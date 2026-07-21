import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, UserRole } from "@/lib/supabase/types";

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
  if (pathname === "/founder" || pathname.startsWith("/founder/")) {
    return "founder";
  }
  if (pathname === "/investor" || pathname.startsWith("/investor/")) {
    return "investor";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }
  if (pathname.startsWith("/api/founder/")) {
    return "founder";
  }
  if (pathname.startsWith("/api/investor/")) {
    return "investor";
  }
  if (pathname.startsWith("/api/admin/")) {
    return "admin";
  }
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

/**
 * Local-development escape hatch for running without Supabase configured.
 *
 * Refuses to apply in production regardless of the flag, so setting it by
 * accident in a production environment cannot open the app — the worst case is
 * that production keeps failing closed, which is the safe direction.
 */
function allowsUnauthenticatedLocalBypass(): boolean {
  if (isProductionEnvironment()) return false;
  return process.env.ALLOW_UNAUTHENTICATED_LOCAL === "true";
}

/**
 * Rollout mode for department scoping on admin API routes. Defaults to "warn":
 * the check runs and logs, but never blocks. Only an explicit "enforce" returns
 * 403, so a feature-registry gap can't lock staff out of their own tools without
 * someone deciding to turn it on.
 */
function adminApiScopingMode(): "off" | "warn" | "enforce" {
  const raw = process.env.ADMIN_API_DEPARTMENT_SCOPING?.toLowerCase();
  return raw === "off" || raw === "enforce" ? raw : "warn";
}

/**
 * Paths that are never department-scoped: personal tools and platform-admin
 * surfaces that carry their own requireRole gate and aren't registered as
 * departmental features. Expressed as page paths — API callers strip "/api"
 * before checking, so one list covers both.
 */
const DEPARTMENT_EXEMPT_PREFIXES = [
  "/admin/dashboard",
  "/admin/profile",
  "/admin/ceo",
  "/admin/calendar",
  "/admin/schedule",
  "/admin/meet",
  "/admin/meetings",
] as const;

function isDepartmentExempt(p: string): boolean {
  if (p === "/admin") return true;
  return DEPARTMENT_EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * True when this user belongs to a department and none of its granted features
 * cover `featurePath`. Fails CLOSED-to-false (i.e. allows) on any error, matching
 * the page-route behaviour — a transient RPC failure must not deny access.
 */
async function isDepartmentDenied(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  featurePath: string,
): Promise<boolean> {
  if (isDepartmentExempt(featurePath)) return false;
  try {
    const { count } = await supabase
      .from("department_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);
    // Unassigned users are not scoped.
    if ((count ?? 0) === 0) return false;

    // get_user_features is not in the generated types yet → loose call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feats, error } = await (supabase.rpc as any)("get_user_features", { p_user_id: userId });
    if (error || !Array.isArray(feats)) return false;

    const paths = (feats as Array<{ path: string }>).map((f) => f.path);
    const allowed = paths.some((fp) =>
      fp === "/admin" ? featurePath === "/admin" : featurePath === fp || featurePath.startsWith(`${fp}/`),
    );
    return !allowed;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!shouldProtectPath(pathname)) {
    return response;
  }

  const zone = resolveWorkspaceZone(pathname);
  if (!zone) {
    return response;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, configured } = getPublicSupabaseEnv();
  const apiRequest = isApiRequest(pathname);

  // Unconfigured Supabase env now fails CLOSED in every environment.
  //
  // This used to pass every protected route straight through whenever the env
  // was unconfigured and APP_ENV/VERCEL_ENV weren't "production" — so a single
  // typo'd or missing variable on a preview deployment opened /admin, /founder,
  // and /investor to anyone with the URL. Preview environments frequently hold
  // real data, so "not production" is not a safe proxy for "not sensitive".
  //
  // The escape hatch is deliberately explicit and refuses to work in production,
  // so it can only ever help someone running the app locally without Supabase.
  if (!configured) {
    if (allowsUnauthenticatedLocalBypass()) {
      console.warn(
        `[proxy] Supabase env is not configured and ALLOW_UNAUTHENTICATED_LOCAL=true — ${pathname} served WITHOUT authentication. Never set this outside local development.`,
      );
      return response;
    }
    if (apiRequest) {
      return jsonError(503, "Authentication service is not configured.");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/configuration-error";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
    url.pathname = "/auth/sign-in";
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
    url.pathname = "/auth/sign-in";
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
    url.pathname = dashboardByRole[role];
    return NextResponse.redirect(url);
  }

  // ── Department-scoped access ──
  // Scoping is by DEPARTMENT membership, not role. Admin-department members and
  // unassigned users bypass (the RPC returns all features for admin-dept members;
  // unassigned users are skipped by the count check below). Anyone assigned to a
  // non-admin department is scoped to their granted feature paths. Fails OPEN on
  // any error so a registry gap never locks staff out. Landing/profile always OK.
  // API routes carry the same department scoping as pages, but rollout is staged
  // via ADMIN_API_DEPARTMENT_SCOPING because a feature-registry gap here would
  // return 403 to legitimate staff mid-task rather than merely redirecting them:
  //   off     — no check (previous behaviour)
  //   warn    — log what WOULD be denied, allow the request (default)
  //   enforce — return 403
  // Run in `warn` until the logs are quiet, then switch to `enforce`.
  if (zone === "admin" && apiRequest && adminApiScopingMode() !== "off") {
    const featurePath = pathname.replace(/^\/api/, "");
    const denied = await isDepartmentDenied(supabase, user.id, featurePath);
    if (denied) {
      if (adminApiScopingMode() === "enforce") {
        return jsonError(403, "Your department does not have access to this feature.");
      }
      console.warn(
        `[proxy] department scoping (warn): user ${user.id} would be denied ${pathname} — no granted feature covers ${featurePath}`,
      );
    }
  }

  if (zone === "admin" && !apiRequest) {
    if (await isDepartmentDenied(supabase, user.id, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      url.search = "";
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/founder",
    "/founder/:path*",
    "/investor",
    "/investor/:path*",
    "/admin",
    "/admin/:path*",
    "/api/founder/:path*",
    "/api/investor/:path*",
    "/api/admin/:path*",
  ],
};
