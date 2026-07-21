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
 * Outcome of a department check. `unavailable` is deliberately distinct from
 * `allowed`: previously a failed lookup was indistinguishable from a granted
 * one, so an RPC outage silently granted access everywhere. Keeping it separate
 * lets pages stay permissive while API routes fail closed.
 */
type DepartmentCheck = "allowed" | "denied" | "unavailable";

async function checkDepartmentAccess(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  featurePath: string,
): Promise<DepartmentCheck> {
  if (isDepartmentExempt(featurePath)) return "allowed";
  try {
    const { count, error: countError } = await supabase
      .from("department_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) return "unavailable";
    // Unassigned users are not department-scoped at all.
    if ((count ?? 0) === 0) return "allowed";

    // get_user_features is not in the generated types yet → loose call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feats, error } = await (supabase.rpc as any)("get_user_features", { p_user_id: userId });
    if (error || !Array.isArray(feats)) return "unavailable";

    const paths = (feats as Array<{ path: string }>).map((f) => f.path);
    const allowed = paths.some((fp) =>
      fp === "/admin" ? featurePath === "/admin" : featurePath === fp || featurePath.startsWith(`${fp}/`),
    );
    return allowed ? "allowed" : "denied";
  } catch {
    return "unavailable";
  }
}

/**
 * What to do with a check result.
 *
 * Pages stay permissive on `unavailable` — a transient failure that redirects
 * staff to the dashboard mid-task is a worse trade than briefly showing a page
 * their department may not own, and the page still has its own requireRole gate.
 *
 * API routes fail CLOSED on `unavailable` once enforcing, because the failure
 * mode there is an unguarded data export rather than a misplaced nav item.
 */
export function resolveDepartmentAction(
  surface: "page" | "api",
  mode: "off" | "warn" | "enforce",
  check: DepartmentCheck,
): "allow" | "block" | "warn" {
  if (check === "allowed") return "allow";
  if (surface === "page") return check === "denied" ? "block" : "allow";
  if (mode === "off") return "allow";
  if (mode === "warn") return "warn";
  return "block";
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
  // unassigned users bypass. Anyone assigned to a non-admin department is scoped
  // to their granted feature paths. Landing/profile and personal tools are exempt.
  //
  // API rollout is staged via ADMIN_API_DEPARTMENT_SCOPING:
  //   off     — no check
  //   warn    — log what WOULD be blocked, allow the request (default)
  //   enforce — return 403
  //
  // See resolveDepartmentAction for how a failed lookup is treated: pages stay
  // permissive, enforcing API routes fail closed.
  if (zone === "admin" && apiRequest && adminApiScopingMode() !== "off") {
    const featurePath = pathname.replace(/^\/api/, "");
    const check = await checkDepartmentAccess(supabase, user.id, featurePath);
    const action = resolveDepartmentAction("api", adminApiScopingMode(), check);
    if (action === "block") {
      return check === "unavailable"
        ? jsonError(503, "Permission check unavailable. Please retry.")
        : jsonError(403, "Your department does not have access to this feature.");
    }
    if (action === "warn") {
      console.warn(
        `[proxy] department scoping (warn): user ${user.id} would be blocked on ${pathname} — check result "${check}" for ${featurePath}`,
      );
    }
  }

  if (zone === "admin" && !apiRequest) {
    const check = await checkDepartmentAccess(supabase, user.id, pathname);
    if (resolveDepartmentAction("page", adminApiScopingMode(), check) === "block") {
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
