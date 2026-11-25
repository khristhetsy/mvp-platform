// Learning dashboard: one read across courses, founders, lessons, quizzes,
// certificates and approvals. Pure builder + a loader that feeds it.
// Counts only. No founder rows leave this file.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { COACH_COURSES } from "@/lib/learning/coach/courses";
import { CAPITAL_STAGE_MODULES } from "@/lib/learning/capital-stages";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** A record behind a number, with the page it opens. */
export interface DashRecord {
  title: string;
  sub?: string;
  href: string;
  hrefLabel?: string;
}

export interface LearningRecords {
  courses: DashRecord[];
  lessons: DashRecord[];
  founders: DashRecord[];
  quizzes: DashRecord[];
  certificates: DashRecord[];
}

export const EMPTY_RECORDS: LearningRecords = { courses: [], lessons: [], founders: [], quizzes: [], certificates: [] };

const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "no date";

export function courseRecord(c: { id: string; title: string; content_status: string | null }): DashRecord {
  return { title: c.title, sub: c.content_status ?? undefined, href: `/admin/learning/courses/${c.id}`, hrefLabel: "Open course" };
}

export function lessonRecord(l: { module_slug: string; lesson_id: string; completed_at: string | null }, name: string | undefined): DashRecord {
  const mod = CAPITAL_STAGE_MODULES.find((m) => m.slug === l.module_slug)?.title ?? l.module_slug;
  return { title: `${mod}, ${l.lesson_id}`, sub: `${name ?? "Name not on file"}, completed ${shortDate(l.completed_at)}`, href: "/admin/learning/founders", hrefLabel: "Open founder" };
}

export function founderRecord(f: { percent_complete: number | null }, name: string | undefined, i: number): DashRecord {
  return { title: name ?? `Enrolled founder ${i + 1}`, sub: `${name ? "" : "Name not on file, "}${f.percent_complete ?? 0}% complete`, href: "/admin/learning/founders", hrefLabel: "Open roster" };
}

export interface LearningDashboardInput {
  coursesTotal: number;
  coursesPublished: number;
  coursesDraft: number;
  pendingReview: number;
  enrolledFounders: number;
  lessonCompletions: number;
  quizAttempts: number;
  certificates: number;
  coached: Array<{ slug: string; title: string; lessons: number }>;
  records?: LearningRecords;
}

export interface LearningAttentionItem {
  tone: "bad" | "warn" | "info";
  text: string;
}

export interface LearningDashboard {
  totals: Omit<LearningDashboardInput, "coached" | "records">;
  coached: LearningDashboardInput["coached"];
  records: LearningRecords;
  attention: LearningAttentionItem[];
  /** Published share of all courses, or null when there are no courses. */
  publishedPercent: number | null;
}

export function buildLearningDashboard(input: LearningDashboardInput): LearningDashboard {
  const { coached, records = EMPTY_RECORDS, ...totals } = input;

  const attention: LearningAttentionItem[] = [];
  if (totals.lessonCompletions > 0 && totals.quizAttempts === 0) {
    attention.push({
      tone: "warn",
      text: `${totals.lessonCompletions} lesson${totals.lessonCompletions === 1 ? " is" : "s are"} complete and no quiz has been attempted.`,
    });
  }
  if (totals.pendingReview > 0) {
    attention.push({
      tone: "warn",
      text: `${totals.pendingReview} course${totals.pendingReview === 1 ? " is" : "s are"} waiting for review.`,
    });
  }
  if (totals.coursesDraft > 0) {
    attention.push({
      tone: "info",
      text: `${totals.coursesDraft} course${totals.coursesDraft === 1 ? " is" : "s are"} still in draft.`,
    });
  }

  return {
    totals,
    coached,
    records,
    attention,
    publishedPercent: totals.coursesTotal > 0 ? Math.round((totals.coursesPublished / totals.coursesTotal) * 100) : null,
  };
}

export async function loadLearningDashboard(supabase: SupabaseClient<Database>): Promise<LearningDashboard> {
  const [
    coursesTotal,
    coursesPublished,
    coursesDraft,
    lessonCompletions,
    quizAttempts,
    pendingApprovals,
    certificatesIssued,
    foundersEnrolled,
  ] = await Promise.all([
    supabase.from("learning_programs").select("id", { count: "exact", head: true }),
    supabase.from("learning_programs").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("learning_programs").select("id", { count: "exact", head: true }).eq("content_status", "draft"),
    supabase.from("founder_lesson_progress").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("founder_quiz_attempts").select("id", { count: "exact", head: true }),
    supabase.from("learning_programs").select("id", { count: "exact", head: true }).eq("content_status", "pending_review"),
    supabase.from("learning_certificates").select("id", { count: "exact", head: true }),
    supabase.from("learning_progress").select("founder_id", { count: "exact", head: true }),
  ]);

  const db = raw(supabase);
  const [courseRows, lessonRows, founderRows, quizRows, certRows] = await Promise.all([
    db.from("learning_programs").select("id, title, content_status").order("order_index", { ascending: true }).limit(50),
    db.from("founder_lesson_progress").select("module_slug, lesson_id, founder_id, completed_at").eq("status", "completed").order("completed_at", { ascending: false }).limit(8),
    db.from("learning_progress").select("founder_id, percent_complete").limit(50),
    db.from("founder_quiz_attempts").select("module_slug, score, passed, founder_id, created_at").order("created_at", { ascending: false }).limit(8),
    db.from("learning_certificates").select("certificate_title, founder_id, issued_at").order("issued_at", { ascending: false }).limit(8),
  ]);
  const lessons = (lessonRows.data ?? []) as Array<{ module_slug: string; lesson_id: string; founder_id: string; completed_at: string | null }>;
  const founders = (founderRows.data ?? []) as Array<{ founder_id: string; percent_complete: number | null }>;
  const quizzes = (quizRows.data ?? []) as Array<{ module_slug: string; score: number | null; passed: boolean | null; founder_id: string; created_at: string }>;
  const certs = (certRows.data ?? []) as Array<{ certificate_title: string | null; founder_id: string; issued_at: string | null }>;

  const ids = Array.from(new Set([...lessons, ...founders, ...quizzes, ...certs].map((r) => r.founder_id).filter(Boolean)));
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await db.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) names.set(p.id, p.full_name);
    }
  }

  const records: LearningRecords = {
    courses: ((courseRows.data ?? []) as Array<{ id: string; title: string; content_status: string | null }>).map(courseRecord),
    lessons: lessons.map((l) => lessonRecord(l, names.get(l.founder_id))),
    founders: founders.map((f, i) => founderRecord(f, names.get(f.founder_id), i)),
    quizzes: quizzes.map((q) => ({
      title: q.module_slug,
      sub: `${names.get(q.founder_id) ?? "Name not on file"}, ${q.passed ? "passed" : "not passed"}, ${shortDate(q.created_at)}`,
      href: "/admin/learning/analytics",
      hrefLabel: "Analytics",
    })),
    certificates: certs.map((c) => ({
      title: c.certificate_title ?? "Certificate of Completion",
      sub: `${names.get(c.founder_id) ?? "Name not on file"}, issued ${shortDate(c.issued_at)}`,
      href: "/admin/learning/certificates",
      hrefLabel: "Certificates",
    })),
  };

  return buildLearningDashboard({
    records,
    coursesTotal: coursesTotal.count ?? 0,
    coursesPublished: coursesPublished.count ?? 0,
    coursesDraft: coursesDraft.count ?? 0,
    pendingReview: pendingApprovals.count ?? 0,
    enrolledFounders: foundersEnrolled.count ?? 0,
    lessonCompletions: lessonCompletions.count ?? 0,
    quizAttempts: quizAttempts.count ?? 0,
    certificates: certificatesIssued.count ?? 0,
    coached: COACH_COURSES.map((c) => ({
      slug: c.slug,
      title: c.title,
      lessons: c.sections.reduce((n, s) => n + s.lessons.length, 0),
    })),
  });
}
