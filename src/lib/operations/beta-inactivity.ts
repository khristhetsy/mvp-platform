import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type InactivityFlag = {
  profileId: string;
  role: "founder" | "investor";
  name: string;
  email: string | null;
  flag: string;
  detail: string;
  severity: "low" | "medium" | "high";
  deepLink: string;
  lastActivityAt: string | null;
};

const INACTIVE_DAYS = 7;
const SIGNUP_STALL_DAYS = 3;

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function lastActivityForUsers(admin: SupabaseClient<Database>, userIds: string[]) {
  const map = new Map<string, string>();
  if (!userIds.length) return map;

  const [{ data: auditRows }, { data: opRows }] = await Promise.all([
    admin.from("audit_logs").select("user_id, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
    admin
      .from("operational_activity_events")
      .select("actor_user_id, created_at")
      .in("actor_user_id", userIds)
      .order("created_at", { ascending: false }),
  ]);

  for (const row of auditRows ?? []) {
    if (!row.user_id) continue;
    const userId = String(row.user_id);
    if (!map.has(userId)) map.set(userId, String(row.created_at));
  }
  for (const row of opRows ?? []) {
    if (!row.actor_user_id) continue;
    const userId = String(row.actor_user_id);
    const existing = map.get(userId);
    const createdAt = String(row.created_at);
    if (!existing || createdAt > existing) map.set(userId, createdAt);
  }

  return map;
}

export async function detectBetaInactivityFlags(admin: SupabaseClient<Database>): Promise<InactivityFlag[]> {
  const flags: InactivityFlag[] = [];
  const inactiveSince = daysAgoIso(INACTIVE_DAYS);

  const [{ data: founders }, { data: investors }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, created_at").eq("role", "founder").order("created_at", { ascending: false }).limit(100),
    admin.from("profiles").select("id, full_name, email, created_at").eq("role", "investor").order("created_at", { ascending: false }).limit(100),
  ]);

  const allIds = [...(founders ?? []).map((f) => f.id), ...(investors ?? []).map((i) => i.id)];
  const lastActivity = await lastActivityForUsers(admin, allIds);

  for (const founder of founders ?? []) {
    const last = lastActivity.get(founder.id) ?? founder.created_at;
    if (last < inactiveSince) {
      flags.push({
        profileId: founder.id,
        role: "founder",
        name: founder.full_name ?? founder.email ?? "Founder",
        email: founder.email,
        flag: "inactive_7d",
        detail: "No recorded activity in 7+ days",
        severity: "medium",
        deepLink: `/admin/companies`,
        lastActivityAt: last,
      });
    } else if (
      last === founder.created_at &&
      founder.created_at < daysAgoIso(SIGNUP_STALL_DAYS)
    ) {
      flags.push({
        profileId: founder.id,
        role: "founder",
        name: founder.full_name ?? founder.email ?? "Founder",
        email: founder.email,
        flag: "no_activity_after_signup",
        detail: "Signed up but no follow-on activity recorded",
        severity: "high",
        deepLink: `/admin/companies`,
        lastActivityAt: last,
      });
    }
  }

  const { data: stalledCompanies } = await admin
    .from("companies")
    .select("id, founder_id, company_name, review_status, updated_at, onboarding_step_state")
    .in("review_status", ["draft", "pending", "in_review"])
    .lt("updated_at", inactiveSince)
    .limit(50);

  for (const company of stalledCompanies ?? []) {
    if (!company.founder_id) continue;
    flags.push({
      profileId: company.founder_id,
      role: "founder",
      name: company.company_name ?? "Company",
      email: null,
      flag: "onboarding_stalled",
      detail: `Onboarding stalled for ${company.company_name ?? "company"}`,
      severity: "high",
      deepLink: `/admin/companies/${company.id}`,
      lastActivityAt: company.updated_at,
    });
  }

  const { data: pendingInvestors } = await admin
    .from("investor_profiles")
    .select("profile_id, approval_status, submitted_at, updated_at, profiles(full_name, email)")
    .in("approval_status", ["submitted", "changes_requested"])
    .limit(50);

  for (const row of pendingInvestors ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!row.profile_id) continue;
    flags.push({
      profileId: row.profile_id,
      role: "investor",
      name: profile?.full_name ?? profile?.email ?? "Investor",
      email: profile?.email ?? null,
      flag: "approval_pending",
      detail: `Investor approval pending (${row.approval_status})`,
      severity: "high",
      deepLink: `/admin/investors`,
      lastActivityAt: row.submitted_at ?? row.updated_at,
    });
  }

  for (const investor of investors ?? []) {
    const last = lastActivity.get(investor.id) ?? investor.created_at;
    if (last < inactiveSince) {
      flags.push({
        profileId: investor.id,
        role: "investor",
        name: investor.full_name ?? investor.email ?? "Investor",
        email: investor.email,
        flag: "inactive_7d",
        detail: "No recorded activity in 7+ days",
        severity: "medium",
        deepLink: `/admin/investors`,
        lastActivityAt: last,
      });
    } else if (
      last === investor.created_at &&
      investor.created_at < daysAgoIso(SIGNUP_STALL_DAYS)
    ) {
      flags.push({
        profileId: investor.id,
        role: "investor",
        name: investor.full_name ?? investor.email ?? "Investor",
        email: investor.email,
        flag: "no_activity_after_signup",
        detail: "Signed up but no follow-on activity recorded",
        severity: "high",
        deepLink: `/admin/investors`,
        lastActivityAt: last,
      });
    }
  }

  const { data: pendingIntros } = await admin
    .from("intro_requests")
    .select("id, company_id, created_at, status, companies(founder_id, company_name)")
    .eq("status", "requested")
    .lt("created_at", daysAgoIso(2))
    .limit(30);

  for (const intro of pendingIntros ?? []) {
    const company = Array.isArray(intro.companies) ? intro.companies[0] : intro.companies;
    if (!company?.founder_id) continue;
    flags.push({
      profileId: company.founder_id,
      role: "founder",
      name: company.company_name ?? "Founder",
      email: null,
      flag: "unread_intro_request",
      detail: "Pending intro request awaiting founder attention",
      severity: "medium",
      deepLink: `/admin/companies/${intro.company_id}`,
      lastActivityAt: intro.created_at,
    });
  }

  const { data: unresolvedDocRequests } = await admin
    .from("deal_room_document_requests")
    .select("id, room_id, created_at, deal_rooms(founder_id, title)")
    .in("status", ["open", "clarification_requested"])
    .lt("created_at", daysAgoIso(3))
    .limit(30);

  for (const req of unresolvedDocRequests ?? []) {
    const room = Array.isArray(req.deal_rooms) ? req.deal_rooms[0] : req.deal_rooms;
    if (!room?.founder_id) continue;
    flags.push({
      profileId: room.founder_id,
      role: "founder",
      name: room.title ?? "Deal room",
      email: null,
      flag: "unresolved_deal_room_doc",
      detail: "Unresolved deal room document request (3+ days)",
      severity: "high",
      deepLink: `/admin/deal-rooms/${req.room_id}`,
      lastActivityAt: req.created_at,
    });
  }

  return flags.slice(0, 80);
}
