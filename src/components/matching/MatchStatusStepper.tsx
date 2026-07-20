import type { MatchStatus } from "@/lib/matching/transitions";

// Consent-flow stepper for the matching pages. Informational: shows the mutual-
// consent path Suggested → … → Introduced in iCapOS brand tokens. Pass
// `activeStatus` to mark everything up to and including that step as done.
const STEPS: { label: string; statuses: MatchStatus[] }[] = [
  { label: "Suggested", statuses: ["suggested"] },
  { label: "Investor notified", statuses: ["investor_notified"] },
  { label: "Interested", statuses: ["investor_interested"] },
  { label: "Founder approved", statuses: ["founder_approved"] },
  { label: "Introduced", statuses: ["introduced"] },
];

export function MatchStatusStepper({ activeStatus }: Readonly<{ activeStatus?: MatchStatus }>) {
  const activeIndex = activeStatus ? STEPS.findIndex((s) => s.statuses.includes(activeStatus)) : -1;

  return (
    <ol className="mb-5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#5A6782]">
      {STEPS.map((step, i) => {
        const done = activeIndex >= 0 && i <= activeIndex;
        return (
          <li key={step.label} className="flex items-center gap-1.5">
            <span
              className={[
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                done ? "border-[#BEE8D6] bg-[#E6F7F0] font-semibold text-[#0B5C41]" : "border-[#E3E8F2] bg-white",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white",
                  done ? "bg-[#0E9F6E]" : "bg-[#C3CCDB]",
                ].join(" ")}
                aria-hidden="true"
              >
                {done ? "✓" : i + 1}
              </span>
              {step.label}
            </span>
            {i < STEPS.length - 1 ? <span aria-hidden="true" className="text-[#C3CCDB]">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
