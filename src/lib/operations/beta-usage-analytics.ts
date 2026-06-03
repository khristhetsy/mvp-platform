import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type BetaUsageAnalytics = {
  founderModules: { module: string; count: number }[];
  investorModules: { module: string; count: number }[];
  dealRoomEngagement: {
    activeRooms: number;
    questionsLast7d: number;
    docRequestsLast7d: number;
  };
  learningEngagement: {
    lessonsCompletedLast7d: number;
    activeFoundersLast7d: number;
  };
};

const FOUNDER_MODULE_MAP: Record<string, string> = {
  founder: "Dashboard",
  documents: "Documents",
  onboarding: "Onboarding",
  diligence: "Diligence",
  learning: "Learning",
  messaging: "Messages",
  outreach: "Outreach",
  spv: "Capital Raise",
  crm: "Investors CRM",
};

const INVESTOR_MODULE_MAP: Record<string, string> = {
  investor: "Dashboard",
  onboarding: "Onboarding",
  messaging: "Messages",
  spv: "SPVs",
  analytics: "Analytics",
};

function sinceDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadBetaUsageAnalytics(admin: SupabaseClient<Database>): Promise<BetaUsageAnalytics> {
  const since7d = sinceDays(7);

  const [
    eventsRes,
    activeRoomsRes,
    questionsRes,
    docRequestsRes,
    lessonsRes,
    learningFoundersRes,
  ] = await Promise.all([
    admin
      .from("operational_activity_events")
      .select("source_module, event_category, actor_role")
      .gte("created_at", sinceDays(30)),
    admin.from("deal_rooms").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin
      .from("deal_room_questions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d),
    admin
      .from("deal_room_document_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d),
    admin
      .from("founder_lesson_progress")
      .select("id", { count: "exact", head: true })
      .not("completed_at", "is", null)
      .gte("completed_at", since7d),
    admin
      .from("founder_lesson_progress")
      .select("founder_id")
      .gte("last_viewed_at", since7d),
  ]);

  const founderCounts = new Map<string, number>();
  const investorCounts = new Map<string, number>();

  for (const row of eventsRes.data ?? []) {
    const sourceModule = row.source_module ?? "unknown";
    const label =
      row.actor_role === "investor"
        ? (INVESTOR_MODULE_MAP[sourceModule] ?? sourceModule)
        : (FOUNDER_MODULE_MAP[sourceModule] ?? sourceModule);
    const bucket = row.actor_role === "investor" ? investorCounts : founderCounts;
    bucket.set(label, (bucket.get(label) ?? 0) + 1);
  }

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([moduleName, count]) => ({ module: moduleName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

  const activeLearningFounders = new Set((learningFoundersRes.data ?? []).map((r) => r.founder_id));

  return {
    founderModules: toSorted(founderCounts),
    investorModules: toSorted(investorCounts),
    dealRoomEngagement: {
      activeRooms: activeRoomsRes.count ?? 0,
      questionsLast7d: questionsRes.count ?? 0,
      docRequestsLast7d: docRequestsRes.count ?? 0,
    },
    learningEngagement: {
      lessonsCompletedLast7d: lessonsRes.count ?? 0,
      activeFoundersLast7d: activeLearningFounders.size,
    },
  };
}
