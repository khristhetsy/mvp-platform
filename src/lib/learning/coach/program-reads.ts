/**
 * What the coached program reads about a founder, and the pure arithmetic over it.
 *
 * Every read is the founder's own company only, counts only, and each source is isolated: a failed
 * read marks that source unavailable and the page says so instead of showing a number. The pure
 * functions at the bottom (ready contacts, week line, streak, where you stand) take the raw counts,
 * so they are tested without a database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Profile } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getManualRecipients } from "@/lib/outreach/manual-outreach";
import { crrFor } from "@/lib/crr/crr-for";
import { getAgentByOrg } from "@/lib/ir-agent/store";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { weekStartUtc } from "@/lib/matching/intro-quota";
import { INDUSTRY_MEDIAN_MIN_FOUNDERS, OUTREACH_PROGRAM, type ProgramDefinition, type ProgramMetric } from "@/lib/learning/coach/program";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import type { Database } from "@/lib/supabase/types";

export type ContactsRead = { total: number; withEmail: number; withNote: number; ready: number };
export type IntrosRead = { week: number; total: number; dismissed: number; lastAt: string | null };
export type SendsRead = { week: number; total: number; followUpsWeek: number; replies: number; recipients: number };
export type SocialRead = { connected: number; scheduled: number };
export type AutomatedRead = { unlocked: boolean; score: number | null; gate: number };
export type IrAgentRead = { status: string | null };
export type TasksRead = { openOutreach: number };
export type CommitmentRead = { lesson_id: string; status: "open" | "kept" | "missed" | "cancelled"; due_at: string; created_at: string; title: string };
export type DealRoomsRead = { open: number; questionsOpen: number; docRequestsOpen: number };
export type DocumentsRead = { total: number };
export type OfferingRead = { type: string | null; attestedAt: string | null };
export type SpvsRead = { count: number; checklistPct: number | null; closingPct: number | null };
export type PledgesRead = { totalPledged: number; investorCount: number; raise: number | null };
export type UpdatesRead = { last30: number; lastAt: string | null; daysSince: number | null };

export type ProgramRaw = {
  contacts: ContactsRead | null;
  intros: IntrosRead | null;
  sends: SendsRead | null;
  social: SocialRead | null;
  automated: AutomatedRead | null;
  irAgent: IrAgentRead | null;
  /** Not read yet: the events screen has no founder scoped count the coach can trust. */
  events: null;
  tasks: TasksRead | null;
  /** Stage 4 reads. */
  dealRooms: DealRoomsRead | null;
  documents: DocumentsRead | null;
  offering: OfferingRead | null;
  spvs: SpvsRead | null;
  pledges: PledgesRead | null;
  updates: UpdatesRead | null;
  /** Open tasks whose title starts with "Milestone", the founder's dated promises. */
  milestoneTasks: number | null;
  /** Open tasks that mention the deal room, the daily check. */
  roomCheckTasks: number | null;
  commitments: CommitmentRead[];
  /** Lesson slugs of this program's course marked complete in founder_lesson_progress. */
  lessonsDone: string[];
  industry: string | null;
  stage: string | null;
  /** Other companies in the same industry with an active coach enrollment. */
  industryPeers: number;
  readAt: string;
};

async function settle<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

const loose = (c: unknown) => c as SupabaseClient;

export async function loadProgramRaw(input: { profile: Profile; company: Company; now?: Date; program?: ProgramDefinition }): Promise<ProgramRaw> {
  const program = input.program ?? OUTREACH_PROGRAM;
  const now = input.now ?? new Date();
  const since = weekStartUtc(now);
  const admin = loose(createServiceRoleClient());
  const founderId = input.profile.id;
  const companyId = input.company.id;
  const orgId = (input.company as { org_id?: string | null }).org_id ?? null;

  const [contacts, intros, sends, social, automated, irAgent, tasks, commitments, progress, peers, dealRooms, documents, offering, spvs, pledges, updates, milestoneTasks, roomCheckTasks] = await Promise.all([
    settle(async (): Promise<ContactsRead> => {
      const { data, error } = await admin
        .from("founder_investor_contacts")
        .select("email, notes, status")
        .eq("founder_id", founderId)
        .eq("company_id", companyId)
        .neq("status", "archived")
        .limit(2000);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ email: string | null; notes: string | null }>;
      return countContacts(rows);
    }),
    settle(async (): Promise<IntrosRead> => {
      const [member, prospect] = await Promise.all([
        admin.from("intro_requests").select("status, created_at").eq("company_id", companyId).eq("direction", "founder_to_investor").limit(1000),
        admin.from("prospect_intro_requests").select("status, created_at").eq("founder_id", founderId).limit(1000),
      ]);
      if (member.error) throw new Error(member.error.message);
      if (prospect.error) throw new Error(prospect.error.message);
      const rows = [...((member.data ?? []) as Array<{ status: string; created_at: string }>), ...((prospect.data ?? []) as Array<{ status: string; created_at: string }>)];
      return countIntros(rows, since);
    }),
    settle(async (): Promise<SendsRead> => {
      const [{ data, error }, recipients] = await Promise.all([
        admin.from("manual_outreach_sends").select("step_index, sent_at").eq("company_id", companyId).limit(5000),
        getManualRecipients(companyId),
      ]);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ step_index: number; sent_at: string }>;
      return countSends(rows, recipients.map((r) => ({ repliedAt: r.repliedAt })), since);
    }),
    settle(async (): Promise<SocialRead> => {
      const [accounts, variants] = await Promise.all([
        admin.from("social_accounts").select("id").eq("owner_profile_id", founderId).neq("status", "disconnected"),
        admin.from("social_variants").select("id, status, post:social_posts!inner(owner_profile_id)").eq("post.owner_profile_id", founderId).in("status", ["scheduled", "queued", "published"]),
      ]);
      if (accounts.error) throw new Error(accounts.error.message);
      if (variants.error) throw new Error(variants.error.message);
      return { connected: (accounts.data ?? []).length, scheduled: (variants.data ?? []).length };
    }),
    settle(async (): Promise<AutomatedRead> => {
      const crr = await crrFor(companyId);
      return { unlocked: crr.outreachUnlocked, score: crr.score, gate: crr.gate };
    }),
    settle(async (): Promise<IrAgentRead> => {
      if (!orgId) return { status: null };
      const agent = await getAgentByOrg(orgId);
      return { status: (agent as { status?: string } | null)?.status ?? null };
    }),
    settle(async (): Promise<TasksRead> => {
      const { data, error } = await admin
        .from("tasks")
        .select("id")
        .eq("created_by", founderId)
        .eq("task_type", "investor_outreach")
        .in("status", ["todo", "in_progress"])
        .limit(500);
      if (error) throw new Error(error.message);
      return { openOutreach: (data ?? []).length };
    }),
    settle(async (): Promise<CommitmentRead[]> => {
      const { data, error } = await admin
        .from("coach_commitments")
        .select("lesson_id, status, due_at, created_at, title")
        .eq("founder_id", founderId)
        .eq("company_id", companyId)
        .eq("course_slug", program.courseSlug)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as CommitmentRead[];
    }),
    settle(() => listLessonProgressForCompany(founderId, companyId)),
    settle(async (): Promise<number> => {
      const industry = input.company.industry ?? null;
      if (!industry) return 0;
      const { data, error } = await admin.from("companies").select("id").eq("industry", industry).neq("id", companyId).limit(1000);
      if (error) throw new Error(error.message);
      const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
      if (ids.length === 0) return 0;
      const { count } = await admin.from("coach_enrollments").select("id", { count: "exact", head: true }).in("company_id", ids).eq("status", "active");
      return count ?? 0;
    }),
    settle(async (): Promise<DealRoomsRead> => {
      const { data, error } = await admin.from("deal_rooms").select("id, status").eq("company_id", companyId).limit(500);
      if (error) throw new Error(error.message);
      const rooms = (data ?? []) as Array<{ id: string; status: string }>;
      const open = rooms.filter((r) => !["closed", "archived", "cancelled"].includes(r.status));
      const ids = open.map((r) => r.id);
      if (ids.length === 0) return { open: 0, questionsOpen: 0, docRequestsOpen: 0 };
      const [q, d] = await Promise.all([
        admin.from("deal_room_questions").select("id", { count: "exact", head: true }).in("room_id", ids).is("founder_response", null),
        admin.from("deal_room_document_requests").select("id", { count: "exact", head: true }).in("room_id", ids).is("fulfilled_at", null),
      ]);
      return { open: open.length, questionsOpen: q.count ?? 0, docRequestsOpen: d.count ?? 0 };
    }),
    settle(async (): Promise<DocumentsRead> => {
      const { count, error } = await admin.from("documents").select("id", { count: "exact", head: true }).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { total: count ?? 0 };
    }),
    settle(async (): Promise<OfferingRead> => {
      const c = input.company as { offering_type?: string | null; offering_type_attested_at?: string | null };
      return { type: c.offering_type ?? null, attestedAt: c.offering_type_attested_at ?? null };
    }),
    settle(async (): Promise<SpvsRead> => {
      const { data, error } = await admin.from("spv_opportunities").select("checklist_readiness_pct, closing_readiness_pct").eq("company_id", companyId).limit(50);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ checklist_readiness_pct: number | null; closing_readiness_pct: number | null }>;
      const max = (k: "checklist_readiness_pct" | "closing_readiness_pct") => (rows.length ? Math.max(...rows.map((r) => r[k] ?? 0)) : null);
      return { count: rows.length, checklistPct: max("checklist_readiness_pct"), closingPct: max("closing_readiness_pct") };
    }),
    settle(async (): Promise<PledgesRead> => {
      const typed = admin as unknown as SupabaseClient<Database>;
      const pledgeCompanyId = await getFounderPledgeCompanyId(typed, founderId, companyId);
      const summary = await getCompanyPledgeSummary(typed, pledgeCompanyId);
      const raise = (input.company as { funding_amount?: number | string | null }).funding_amount;
      return { totalPledged: summary.totalPledged, investorCount: summary.investorCount, raise: raise === null || raise === undefined ? null : Number(raise) };
    }),
    settle(async (): Promise<UpdatesRead> => {
      const { data, error } = await admin.from("company_updates").select("created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ created_at: string }>;
      return countUpdates(rows, now);
    }),
    settle(async (): Promise<number> => {
      const { count, error } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("created_by", founderId).in("status", ["todo", "in_progress"]).ilike("title", "Milestone%");
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
    settle(async (): Promise<number> => {
      const { count, error } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("created_by", founderId).in("status", ["todo", "in_progress"]).ilike("title", "%deal room%");
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
  ]);

  return {
    contacts,
    intros,
    sends,
    social,
    automated,
    irAgent,
    events: null,
    tasks,
    dealRooms,
    documents,
    offering,
    spvs,
    pledges,
    updates,
    milestoneTasks,
    roomCheckTasks,
    commitments: commitments ?? [],
    lessonsDone: (progress ?? [])
      .filter((r) => r.module_slug === program.courseSlug && r.status === "completed")
      .map((r) => r.lesson_id),
    industry: input.company.industry ?? null,
    stage: (input.company as { funding_stage?: string | null }).funding_stage ?? null,
    industryPeers: peers ?? 0,
    readAt: now.toISOString(),
  };
}

/* Pure arithmetic below. */

export function countContacts(rows: Array<{ email: string | null; notes: string | null }>): ContactsRead {
  const has = (v: string | null) => Boolean(v && v.trim());
  let withEmail = 0;
  let withNote = 0;
  let ready = 0;
  for (const r of rows) {
    const e = has(r.email);
    const n = has(r.notes);
    if (e) withEmail += 1;
    if (n) withNote += 1;
    if (e && n) ready += 1;
  }
  return { total: rows.length, withEmail, withNote, ready };
}

export function countIntros(rows: Array<{ status: string; created_at: string }>, since: string): IntrosRead {
  let week = 0;
  let dismissed = 0;
  let lastAt: string | null = null;
  for (const r of rows) {
    if (r.created_at >= since) week += 1;
    if (r.status === "dismissed" || r.status === "declined") dismissed += 1;
    if (!lastAt || r.created_at > lastAt) lastAt = r.created_at;
  }
  return { week, total: rows.length, dismissed, lastAt };
}

export function countSends(rows: Array<{ step_index: number; sent_at: string }>, recipients: Array<{ repliedAt: string | null }>, since: string): SendsRead {
  let week = 0;
  let followUpsWeek = 0;
  for (const r of rows) {
    if (r.sent_at >= since) {
      if (r.step_index > 0) followUpsWeek += 1;
      else week += 1;
    }
  }
  return { week, total: rows.length, followUpsWeek, replies: recipients.filter((r) => r.repliedAt).length, recipients: recipients.length };
}

export function countUpdates(rows: Array<{ created_at: string }>, now: Date): UpdatesRead {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const last30 = rows.filter((r) => r.created_at >= since).length;
  const lastAt = rows.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);
  const daysSince = lastAt ? Math.floor((now.getTime() - new Date(lastAt).getTime()) / 86_400_000) : null;
  return { last30, lastAt, daysSince };
}

/** The live number the Do step counts for a module, or null when that source could not be read. */
export function metricValue(raw: ProgramRaw, metric: ProgramMetric): number | null {
  switch (metric) {
    case "deal_rooms":
      return raw.dealRooms ? raw.dealRooms.open : null;
    case "documents":
      return raw.documents ? raw.documents.total : null;
    case "room_check":
      return raw.roomCheckTasks;
    case "offering_attested":
      return raw.offering ? (raw.offering.attestedAt || raw.offering.type ? 1 : 0) : null;
    case "checklist":
      return raw.spvs ? (raw.spvs.count === 0 ? 0 : Math.round(((raw.spvs.checklistPct ?? 0) / 100) * 3)) : null;
    case "pledges":
      return raw.pledges ? raw.pledges.investorCount : null;
    case "updates_30d":
      return raw.updates ? raw.updates.last30 : null;
    case "milestone_tasks":
      return raw.milestoneTasks;
    case "self_report":
      return null;
    case "contacts_ready":
      return raw.contacts ? raw.contacts.ready : null;
    case "intro_requests":
      return raw.intros ? raw.intros.week : null;
    case "sends":
      return raw.sends ? raw.sends.week : null;
    case "social":
      return raw.social ? Math.min(raw.social.connected, 1) + Math.min(raw.social.scheduled, 1) : null;
    case "automated":
      return raw.automated ? 1 : null;
    case "ir_agent":
      return raw.irAgent ? (raw.irAgent.status === "live" ? 1 : 0) : null;
    case "tasks":
      return raw.tasks ? raw.tasks.openOutreach : null;
    case "events":
      return null;
  }
}

/** Consecutive weeks, ending with the most recent resolved commitment, in which every resolved commitment was kept. */
export function commitmentStreak(commitments: CommitmentRead[], now: Date = new Date()): { met: number; resolved: number; streak: number } {
  const resolved = commitments.filter((c) => c.status === "kept" || c.status === "missed");
  const met = resolved.filter((c) => c.status === "kept").length;
  const byWeek = new Map<string, boolean>();
  for (const c of resolved) {
    const w = weekStartUtc(new Date(c.due_at));
    byWeek.set(w, (byWeek.get(w) ?? true) && c.status === "kept");
  }
  const weeks = [...byWeek.keys()].sort().reverse();
  let streak = 0;
  const thisWeek = weekStartUtc(now);
  for (const w of weeks) {
    if (w > thisWeek) continue;
    if (byWeek.get(w)) streak += 1;
    else break;
  }
  return { met, resolved: resolved.length, streak };
}

export type StandRow = { key: string; label: string; you: string; lessonTarget: string; stage: string; industry: string };

function industryColumn(raw: ProgramRaw, estimate: string): string {
  const peers = raw.industryPeers;
  const name = raw.industry ?? "your industry";
  if (peers >= INDUSTRY_MEDIAN_MIN_FOUNDERS) return `iCapOS median for ${name} is not computed yet (${peers} founders enrolled). ${estimate}`;
  return `${estimate} iCapOS ${name} peers today: ${peers}. Median shows at ${INDUSTRY_MEDIAN_MIN_FOUNDERS} founders with 4 weeks of data.`;
}

function youColumn(raw: ProgramRaw, program: ProgramDefinition): Record<string, string> {
  const na = "Not read";
  const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  return {
    lessons: `${raw.lessonsDone.length} of ${program.modules.length}`,
    contacts_ready: raw.contacts ? `${raw.contacts.ready} of ${raw.contacts.total}` : na,
    sends_week: raw.sends ? String(raw.sends.week) : na,
    intro_requests: raw.intros ? `${raw.intros.week} this week, ${raw.intros.dismissed} of ${raw.intros.total} dismissed` : na,
    follow_ups: raw.sends ? String(raw.sends.followUpsWeek) : na,
    replies: raw.sends ? `${raw.sends.replies} of ${raw.sends.recipients}` : na,
    meetings: "Not measured here",
    deal_rooms: raw.dealRooms ? String(raw.dealRooms.open) : na,
    questions: raw.dealRooms ? `${raw.dealRooms.questionsOpen} waiting, ${raw.dealRooms.docRequestsOpen} document requests` : na,
    updates: raw.updates ? `${raw.updates.last30}${raw.updates.daysSince !== null ? ` (last ${raw.updates.daysSince} days ago)` : " (none yet)"}` : na,
    checklist: raw.spvs ? (raw.spvs.count === 0 ? "Not started" : `${raw.spvs.checklistPct ?? 0}% ready`) : na,
    pledged: raw.pledges ? `${money(raw.pledges.totalPledged)} from ${raw.pledges.investorCount}${raw.pledges.raise ? ` of ${money(raw.pledges.raise)}` : ""}` : na,
    weeks: "Not measured here",
    meetings_ts: "Not measured here",
  };
}

export function whereYouStand(raw: ProgramRaw, program: ProgramDefinition = OUTREACH_PROGRAM): StandRow[] {
  const you = youColumn(raw, program);
  return program.benchmarks.map((b) => ({ key: b.key, label: b.label, you: you[b.key] ?? "Not read", lessonTarget: b.lessonTarget, stage: b.stage, industry: industryColumn(raw, b.industry) }));
}

/** One sentence for the top of the page: where the founder is this week and the next step. */
export function weekLine(raw: ProgramRaw, lessonSlug: string, program: ProgramDefinition = OUTREACH_PROGRAM): string {
  const m = program.modules.find((x) => x.lessonSlug === lessonSlug) ?? program.modules[0];
  const value = metricValue(raw, m.doMetric);
  const parts: string[] = [];
  if (program.courseSlug === OUTREACH_PROGRAM.courseSlug) {
    if (raw.sends) parts.push(`${raw.sends.week} first messages sent this week`);
    if (raw.contacts) parts.push(`${raw.contacts.ready} of ${raw.contacts.total} contacts ready`);
  } else {
    if (raw.dealRooms) parts.push(`${raw.dealRooms.open} deal rooms open, ${raw.dealRooms.questionsOpen} questions waiting`);
    if (raw.updates) parts.push(raw.updates.daysSince === null ? "no investor update yet" : `last investor update ${raw.updates.daysSince} days ago`);
  }
  const where = parts.length ? parts.join(", ") + "." : "Your numbers could not be read just now.";
  if (value === null) return `${where} Next step: ${m.doIntro.split(".")[0]}.`;
  if (value >= m.doTarget) return `${where} ${m.shortTitle}: target met (${value} of ${m.doTarget}).`;
  return `${where} Next step: ${m.doVerb.toLowerCase()} ${m.doTarget - value} more (${value} of ${m.doTarget}).`;
}
