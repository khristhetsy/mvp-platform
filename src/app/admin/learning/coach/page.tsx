import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSection, WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { CoachCourseSwitch } from "@/components/admin/learning/CoachCourseSwitch";
import { CoachFoundersPanel } from "@/components/admin/learning/CoachFoundersPanel";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildCoachCourseRows,
  buildCoachFounderRows,
  type EnrollmentSource,
  type FounderSource,
} from "@/lib/learning/coach/admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string }>;
type Tab = "courses" | "founders" | "log";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "courses", label: "Courses" },
  { id: "founders", label: "Founders" },
  { id: "log", label: "Activity log" },
];

type MessageRow = {
  id: string;
  founder_id: string;
  kind: string;
  channel: string;
  tone: string;
  status: string;
  suppressed_reason: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  quiet_founder: "Quiet founder",
  commitment_check: "Commitment check",
  follow_up_due: "Follow up due",
  weekly_wrap: "Weekly wrap",
  meeting_prep: "Meeting prep",
  reply_alert: "Reply alert",
  scorecard_check: "Scorecard check",
  intro: "Intro",
};

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminCoachPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const profile = await requireRole(["admin", "analyst"]);
  const params = await searchParams;
  const tab: Tab = params.tab === "founders" || params.tab === "log" ? params.tab : "courses";

  // New coach tables are not in the hand maintained types file yet.
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const [{ data: cfgRaw }, { data: foundersRaw }, { data: enrRaw }, { data: msgRaw }, { data: stepRaw }] = await Promise.all([
    admin.from("course_coach_config").select("course_key, enabled, tone"),
    admin.from("profiles").select("id, full_name, email").eq("role", "founder").order("full_name", { ascending: true }).limit(1000),
    admin.from("coach_enrollments").select("founder_id, company_id, status, tone, source, started_at"),
    admin
      .from("coach_messages")
      .select("id, founder_id, kind, channel, tone, status, suppressed_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("coach_step_events").select("founder_id, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);

  const founders = (foundersRaw ?? []) as FounderSource[];
  const founderIds = founders.map((f) => f.id);
  const { data: compRaw } = founderIds.length
    ? await admin.from("companies").select("id, company_name, founder_id").in("founder_id", founderIds)
    : { data: [] };

  const companyByFounder = new Map<string, { id: string; name: string }>();
  for (const c of (compRaw ?? []) as Array<{ id: string; company_name: string | null; founder_id: string | null }>) {
    if (c.founder_id && !companyByFounder.has(c.founder_id)) companyByFounder.set(c.founder_id, { id: c.id, name: c.company_name ?? "—" });
  }
  const lastStepAt = new Map<string, string>();
  for (const s of (stepRaw ?? []) as Array<{ founder_id: string; created_at: string }>) {
    if (!lastStepAt.has(s.founder_id)) lastStepAt.set(s.founder_id, s.created_at); // newest first
  }

  const courseRows = buildCoachCourseRows((cfgRaw ?? []) as Array<{ course_key: string; enabled: boolean; tone: string | null }>);
  const founderRows = buildCoachFounderRows({
    founders,
    companyByFounder,
    enrollments: (enrRaw ?? []) as EnrollmentSource[],
    lastStepAt,
    now: new Date(),
  });
  const messages = (msgRaw ?? []) as MessageRow[];
  const nameById = new Map(founderRows.map((r) => [r.id, r.name]));

  const active = founderRows.filter((r) => r.status === "active").length;
  const paused = founderRows.filter((r) => r.status === "paused").length;
  const reachOut = messages.filter((m) => m.suppressed_reason === "human_flag_14d").length;
  const enabledCourses = courseRows.filter((r) => r.enabled).length;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Learning"
          title="AI IR Coach"
          description="Switch the coach on for a course, choose who is enrolled, and see what it sent. It stays off until a course is switched on and a founder is enrolled."
          actions={
            <Link href="/admin/learning" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ← Learning overview
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Courses on", value: enabledCourses },
            { label: "Founders enrolled", value: active },
            { label: "Paused", value: paused },
            { label: "Flagged to reach out", value: reachOut, color: reachOut > 0 ? "text-red-600" : "text-slate-900" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className={`text-2xl font-bold ${s.color ?? "text-slate-900"}`}>{s.value}</p>
              <p className="mt-1 text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <nav aria-label="Coach views" className="flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/admin/learning/coach?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "courses" ? (
          <PageSection title="Courses" subtitle="A course can only be switched on once every lesson has coach steps.">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Course</th>
                    <th className="px-5 py-3">Format</th>
                    <th className="px-5 py-3">Coach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courseRows.map((r) => (
                    <tr key={r.key}>
                      <td className="px-5 py-3 font-medium text-slate-900">{r.title}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{r.source}</td>
                      <td className="px-5 py-3"><CoachCourseSwitch row={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageSection>
        ) : null}

        {tab === "founders" ? (
          <PageSection title="Founders" subtitle="Enroll all, selected or let founders opt in. Internal accounts are never emailed.">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <CoachFoundersPanel rows={founderRows} />
            </div>
          </PageSection>
        ) : null}

        {tab === "log" ? (
          <PageSection title="Activity log" subtitle="The last 100 coach messages, newest first. Message text is not shown here.">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-3">When (Pacific)</th>
                    <th className="px-5 py-3">Founder</th>
                    <th className="px-5 py-3">Message</th>
                    <th className="px-5 py-3">Channel</th>
                    <th className="px-5 py-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td className="px-5 py-3 text-xs text-slate-500">{when(m.created_at)}</td>
                      <td className="px-5 py-3 text-slate-900">{nameById.get(m.founder_id) ?? "Unknown"}</td>
                      <td className="px-5 py-3 text-slate-600">{KIND_LABEL[m.kind] ?? m.kind}</td>
                      <td className="px-5 py-3 text-xs capitalize text-slate-500">{m.channel.replace("_", " ")}</td>
                      <td className="px-5 py-3">
                        {m.suppressed_reason === "human_flag_14d" ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Reach out personally (14 days quiet)</span>
                        ) : (
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${m.status === "sent" ? "bg-green-50 text-green-700" : m.status === "failed" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                            {m.status}
                            {m.suppressed_reason ? ` · ${m.suppressed_reason.replace(/_/g, " ")}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {messages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                        Nothing sent yet. Messages appear here once a course is on and founders are enrolled.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </PageSection>
        ) : null}
      </WorkspacePageContainer>
    </AppShell>
  );
}
