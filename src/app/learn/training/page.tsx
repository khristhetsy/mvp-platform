import Link from "next/link";
import { TrainingFrame } from "@/components/training/TrainingFrame";
import { requireUserProfile } from "@/lib/supabase/auth";
import { getOrClaimEnrollment, getProgress } from "@/lib/learning/staff-training/data";
import { modulesForAudience } from "@/lib/learning/staff-training/catalog";

export const dynamic = "force-dynamic";

export default async function MyStaffTrainingPage() {
  const profile = await requireUserProfile();
  const enr = await getOrClaimEnrollment(profile);
  if (!enr) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold text-[#0A1A40]">Training is by invitation</h1>
        <p className="mt-2 text-sm text-slate-600">You do not have access to this course. Ask your iCFO contact for an invitation.</p>
      </main>
    );
  }
  const progress = await getProgress(profile.id);
  const mods = modulesForAudience(enr.audience);
  return (
    <TrainingFrame profile={profile}>
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#0A1A40]">{enr.audience === "licensee" ? "Platform training" : "Training"}</h1>
      <p className="mt-1 text-sm text-slate-600">Reviewer: {enr.reviewer_label}. AI coach {enr.coach_on ? "on" : "off"}.</p>
      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {mods.map((m) => {
          const total = m.steps?.length ?? 0;
          const done = (progress[m.key] ?? []).length;
          return (
            <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div><p className="text-sm font-medium text-slate-900">{m.title}</p><p className="text-xs text-slate-500">{m.part}</p></div>
              {m.status === "ready"
                ? <Link href={`/learn/training/${m.key}`} className="text-xs font-semibold text-[#1A6CE4]">{done} of {total} steps, open</Link>
                : <span className="text-xs text-slate-400">Coming soon</span>}
            </li>
          );
        })}
      </ul>
    </main>
    </TrainingFrame>
  );
}
