import Link from "next/link";

const STEPS = [
  { title: "Submitted", body: "Your profile and accreditation statement are with our team.", state: "done" },
  { title: "We review your profile", body: "We check that your details are complete. If we need anything, we'll email you.", state: "current" },
  { title: "You're approved", body: "Your profile goes live to our matching engine.", state: "todo" },
  { title: "You meet matched founders", body: "Founders that fit your industry, stage, and geographies appear in your matches. You choose who to meet.", state: "todo" },
] as const;

/**
 * Shown in place of the read only form once an investor has submitted for
 * approval. Says what happens next, and what would still raise the match score.
 */
export function InvestorSubmittedNextSteps({
  checkSizeMissing,
  answeredPoints,
  totalPoints,
  checkSizePoints,
}: Readonly<{ checkSizeMissing: boolean; answeredPoints: number; totalPoints: number; checkSizePoints: number }>) {
  const pct = totalPoints > 0 ? Math.round((answeredPoints / totalPoints) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" aria-hidden>
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h2 className="mt-3 text-xl font-semibold text-slate-900">Your profile is in review</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-600">
          Thanks for submitting. Our team will check it and email you the result. Nothing else is needed from you right now.
        </p>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">What happens next</p>
        <ol className="mt-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <div className="flex flex-col items-center">
                {s.state === "done" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                ) : s.state === "current" ? (
                  <span className="h-6 w-6 rounded-full border-2 border-[#185FA5] bg-blue-50" />
                ) : (
                  <span className="h-6 w-6 rounded-full border-[1.5px] border-slate-300" />
                )}
                {i < STEPS.length - 1 ? <span className="my-1 w-px flex-1 bg-slate-200" /> : null}
              </div>
              <div className={i < STEPS.length - 1 ? "pb-4" : ""}>
                <p className="text-sm font-semibold text-slate-900">
                  {s.title}
                  {s.state === "current" ? (
                    <span className="ml-2 rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-normal text-[#185FA5]">In progress</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-slate-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {checkSizeMissing ? (
        <div className="rounded-2xl bg-blue-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-[#185FA5]">Add your check size after approval</p>
            <p className="text-[13px] text-[#185FA5]">{answeredPoints} to {answeredPoints + checkSizePoints} points</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#1A6CE4]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-[13px] leading-5 text-[#185FA5]">
            It&apos;s the only field left. It&apos;s worth {checkSizePoints} matching points and helps us show you rounds that fit your check range.
            Your profile is locked while we review it, so you can add it from Settings once you&apos;re approved.
          </p>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Link href="/investor/dashboard" className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800">
          Go to dashboard
        </Link>
      </div>

      <p className="text-center text-[11px] leading-5 text-slate-400">
        iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.
      </p>
    </div>
  );
}
