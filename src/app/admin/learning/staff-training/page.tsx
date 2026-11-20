import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { StaffTrainingAdminClient } from "@/components/training/StaffTrainingAdminClient";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";
import { service } from "@/lib/learning/staff-training/data";
import { modulesForAudience, readyModuleCount, type TrainingAudience } from "@/lib/learning/staff-training/catalog";

export const dynamic = "force-dynamic";

type Row = Record<string, string | number | boolean | null>;

export default async function AdminStaffTrainingPage() {
  if (isAdminModuleComingSoon("learning")) redirect("/admin/learning");
  const profile = await requireRole(["admin", "analyst"]);
  const db = service();

  const [{ data: invites }, { data: enr }, { data: prog }, { data: ex }] = await Promise.all([
    db.from("staff_training_invites").select("id, email, audience, status, expires_at, organization_label").order("created_at", { ascending: false }).limit(200),
    db.from("staff_training_enrollments").select("id, user_id, audience, coach_on, coach_tone").eq("status", "active").limit(500),
    db.from("staff_training_progress").select("user_id").eq("done", true).limit(20000),
    db.from("staff_training_exercises").select("id, user_id, module_key, exercise_index, answer, ai_feedback").eq("status", "submitted").order("created_at").limit(100),
  ]);

  const ids = Array.from(new Set([...(enr ?? []).map((e: Row) => e.user_id as string), ...(ex ?? []).map((e: Row) => e.user_id as string)]));
  const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] as Row[] };
  const emailOf = new Map((profs ?? []).map((p: Row) => [p.id as string, (p.email as string) ?? "unknown"]));
  const doneBy = new Map<string, number>();
  for (const p of (prog ?? []) as Row[]) doneBy.set(p.user_id as string, (doneBy.get(p.user_id as string) ?? 0) + 1);
  const stepsFor = (a: TrainingAudience) => modulesForAudience(a).reduce((n, m) => n + (m.steps?.length ?? 0), 0);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Learning"
          title="Staff Training"
          description={`Invitation only. ${readyModuleCount()} sessions are written; the rest show as coming soon. Nobody can open the course without accepting an invitation.`}
        />
        <StaffTrainingAdminClient
          invites={(invites ?? []) as never}
          enrollments={(enr ?? []).map((e: Row) => ({
            id: e.id as string, email: emailOf.get(e.user_id as string) ?? "unknown", audience: e.audience as string,
            coach_on: e.coach_on as boolean, coach_tone: e.coach_tone as string,
            done: doneBy.get(e.user_id as string) ?? 0, total: stepsFor(e.audience as TrainingAudience),
          }))}
          exercises={(ex ?? []).map((e: Row) => ({ ...e, email: emailOf.get(e.user_id as string) ?? "unknown" })) as never}
        />
      </WorkspacePageContainer>
    </AppShell>
  );
}
