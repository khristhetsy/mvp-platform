import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StaffTrainingClassClient } from "@/components/training/StaffTrainingClassClient";
import { requireUserProfile } from "@/lib/supabase/auth";
import { getEnrollment, getProgress } from "@/lib/learning/staff-training/data";
import { getTrainingModule, modulesForAudience } from "@/lib/learning/staff-training/catalog";

export const dynamic = "force-dynamic";

export default async function StaffTrainingClassPage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  const profile = await requireUserProfile();
  const enr = await getEnrollment(profile.id);
  if (!enr) redirect("/training/staff");
  const mod = getTrainingModule(moduleKey);
  if (!mod || mod.status !== "ready" || !modulesForAudience(enr.audience).some((m) => m.key === mod.key)) notFound();
  const progress = await getProgress(profile.id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/training/staff" className="text-xs font-medium text-[#1A6CE4]">Back to my training</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold text-[#0A1A40]">{mod.title}</h1>
      <p className="mb-6 text-sm text-slate-600">Goal: {mod.goal}</p>
      <StaffTrainingClassClient mod={mod} doneSteps={progress[mod.key] ?? []} coachOn={enr.coach_on} reviewer={enr.reviewer_label} />
    </main>
  );
}
