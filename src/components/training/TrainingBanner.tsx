import Link from "next/link";
import { getOrClaimEnrollment } from "@/lib/learning/staff-training/data";
import { modulesForAudience, readyModuleCount } from "@/lib/learning/staff-training/catalog";

/** Shown on the Learning overview, only to people who hold a training invitation. Renders nothing otherwise. */
export async function TrainingBanner({ userId, email }: { userId: string; email?: string | null }) {
  const enr = await getOrClaimEnrollment({ id: userId, email }).catch(() => null);
  if (!enr) return null;
  const mods = modulesForAudience(enr.audience);
  return (
    <section className="mb-4 rounded-2xl bg-[#0A1A40] p-5 text-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9db8ea]">
        Coached course <span className="ml-2 rounded-md bg-[#1A6CE4] px-2 py-0.5 normal-case tracking-normal text-white">By invitation</span>
      </p>
      <h2 className="mt-2 text-xl font-semibold">{enr.audience === "licensee" ? "Platform training" : "Training"}</h2>
      <p className="mt-1 text-sm text-slate-300">
        {readyModuleCount(mods)} sessions ready. AI coach {enr.coach_on ? "on" : "off"}. Reviewer: {enr.reviewer_label}.
      </p>
      <Link href="/learn/training" className="mt-4 inline-block rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5]">
        Continue training
      </Link>
    </section>
  );
}
