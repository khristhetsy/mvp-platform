import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type InvestorDebugTable = {
  tableName: "saved_deals" | "investor_interests" | "intro_requests" | "investor_activity" | "investor_pipeline";
  apiAlias: string;
};

const INVESTOR_DEBUG_TABLES: InvestorDebugTable[] = [
  { tableName: "saved_deals", apiAlias: "investor_saved_deals" },
  { tableName: "investor_interests", apiAlias: "investor_interests" },
  { tableName: "intro_requests", apiAlias: "investor_intro_requests" },
  { tableName: "investor_activity", apiAlias: "investor_activity" },
  { tableName: "investor_pipeline", apiAlias: "investor_pipeline" },
];

function mapDebugRow(row: Record<string, unknown>) {
  return {
    id: row.id ?? null,
    investor_id: row.investor_id ?? null,
    user_id: row.user_id ?? null,
    profile_id: row.profile_id ?? null,
    company_id: row.company_id ?? null,
    created_at: row.created_at ?? null,
    pledge_amount: row.pledge_amount ?? null,
    activity_type: row.activity_type ?? null,
    stage: row.stage ?? null,
  };
}

async function countByInvestorId(
  supabase: ReturnType<typeof createServiceRoleClient> | Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tableName: InvestorDebugTable["tableName"],
  investorId: string,
) {
  const { count, error } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq("investor_id", investorId);

  return { count: count ?? 0, error: error?.message ?? null };
}

async function recentRowsForInvestorIds(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tableName: InvestorDebugTable["tableName"],
  investorIds: string[],
) {
  const uniqueIds = [...new Set(investorIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return { rows: [] as Record<string, unknown>[], error: null };
  }

  const query =
    uniqueIds.length === 1
      ? supabase.from(tableName).select("*").eq("investor_id", uniqueIds[0]!).order("created_at", { ascending: false }).limit(5)
      : supabase.from(tableName).select("*").in("investor_id", uniqueIds).order("created_at", { ascending: false }).limit(5);

  const { data, error } = await query;

  return {
    rows: (data ?? []) as Record<string, unknown>[],
    error: error?.message ?? null,
  };
}

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_INVESTOR_DEBUG !== "true") {
    return NextResponse.json({ error: "Investor debug route disabled in production." }, { status: 404 });
  }

  const sessionSupabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await sessionSupabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profileRaw, error: profileError } = await sessionSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) {
    return NextResponse.json({ error: "Profile not found.", authUserId: user.id }, { status: 403 });
  }

  const role = normalizeUserRole(String(profileRaw.role));
  const profile = { ...(profileRaw as Profile), role: role ?? (profileRaw.role as UserRole) };

  if (!role || (role !== "investor" && role !== "admin" && role !== "analyst")) {
    return NextResponse.json(
      { error: "Only investor or admin accounts can use this debug route.", profileRole: profile.role },
      { status: 403 },
    );
  }

  const authUserId = user.id;
  const profileId = profile.id;
  const serviceSupabase = createServiceRoleClient();
  const lookupIds = authUserId === profileId ? [authUserId] : [authUserId, profileId];

  const tables = await Promise.all(
    INVESTOR_DEBUG_TABLES.map(async ({ tableName, apiAlias }) => {
      const [serviceAuthCount, serviceProfileCount, sessionAuthCount, recent] = await Promise.all([
        countByInvestorId(serviceSupabase, tableName, authUserId),
        countByInvestorId(serviceSupabase, tableName, profileId),
        countByInvestorId(sessionSupabase, tableName, authUserId),
        recentRowsForInvestorIds(serviceSupabase, tableName, lookupIds),
      ]);

      return {
        tableName,
        apiAlias,
        filterColumn: "investor_id",
        counts: {
          serviceRoleByAuthUserId: serviceAuthCount.count,
          serviceRoleByProfileId: serviceProfileCount.count,
          sessionRoleByAuthUserId: sessionAuthCount.count,
        },
        errors: {
          serviceRoleByAuthUserId: serviceAuthCount.error,
          serviceRoleByProfileId: serviceProfileCount.error,
          sessionRoleByAuthUserId: sessionAuthCount.error,
          recentRows: recent.error,
        },
        recentRows: recent.rows.map(mapDebugRow),
      };
    }),
  );

  const sessionVsServiceRoleGap = tables.some(
    (table) =>
      table.counts.serviceRoleByAuthUserId > 0 &&
      table.counts.sessionRoleByAuthUserId === 0 &&
      !table.errors.sessionRoleByAuthUserId,
  );

  return NextResponse.json({
    authUserId,
    profileId,
    profileRole: profile.role,
    email: profile.email,
    identityMatch: authUserId === profileId,
    sessionVsServiceRoleGap,
    writeRouteIdentifier: "investor_id = auth.profile.id (= Supabase auth user id)",
    readFilterIdentifier: "investor_id = authenticated auth user id",
    tables,
  });
}
