import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/supabase/auth";
import { getOrClaimEnrollment } from "@/lib/learning/staff-training/data";
import { getTrainingProgramId } from "@/lib/learning/course-access";

export const dynamic = "force-dynamic";

/**
 * Training is a normal course in Learning. This address stays as the link in invitation emails and the
 * menu: it finds the Training course and opens it, or says the course is by invitation.
 */
export default async function TrainingEntryPage() {
  const profile = await requireUserProfile();
  const enr = await getOrClaimEnrollment(profile);
  const programId = enr ? await getTrainingProgramId() : null;
  if (programId) {
    redirect(profile.role === "founder" ? `/founder/learning/courses/${programId}` : `/admin/learning/courses/${programId}`);
  }
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold text-[#0A1A40]">Training is by invitation</h1>
      <p className="mt-2 text-sm text-slate-600">You do not have access to this course. Ask your iCFO contact for an invitation.</p>
    </main>
  );
}
