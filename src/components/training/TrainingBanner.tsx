import Link from "next/link";
import { getOrClaimEnrollment } from "@/lib/learning/staff-training/data";
import { modulesForAudience, readyModuleCount } from "@/lib/learning/staff-training/catalog";

/** Shown on the Learning dashboard, only to people who hold a training invitation. Renders nothing otherwise. */
export async function TrainingBanner({ userId, email }: { userId: string; email?: string | null }) {
  const enr = await getOrClaimEnrollment({ id: userId, email }).catch(() => null);
  if (!enr) return null;
  const mods = modulesForAudience(enr.audience);
  const pill = "rounded-full bg-white px-4 py-1.5 text-sm text-slate-700";
  return (
    <section className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="mr-1 text-[11px] font-bold uppercase tracking-[0.08em] text-red-700">Coached course</p>
      <span className={`${pill} font-bold text-red-700`}>{enr.audience === "licensee" ? "Platform training" : "Training"}</span>
      <span className={pill}>
        <b className="text-red-700">{readyModuleCount(mods)}</b> sessions ready
      </span>
      <span className={pill}>
        AI coach <b className="text-red-700">{enr.coach_on ? "on" : "off"}</b>
      </span>
      <span className={pill}>
        Reviewer <b className="text-red-700">{enr.reviewer_label}</b>
      </span>
      <Link href="/learn/training" className={`${pill} font-semibold text-[#1A6CE4] hover:bg-slate-50`}>
        Continue training →
      </Link>
    </section>
  );
}
