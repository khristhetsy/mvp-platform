// Reusable onboarding step indicator. Done (green ✓), active (royal, bold),
// upcoming (gray). Connector bars fill green behind completed steps. Labels hide
// under 640px (dots remain). Matches icapos-offering-type-mockup.html.

export function ProgressSteps({
  steps,
  current,
}: Readonly<{ steps: readonly string[]; current: number }>) {
  return (
    <ol className="mx-auto flex max-w-[760px] list-none items-center gap-2 px-5 text-xs text-[#5A6782]">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={[
                  "grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-semibold",
                  done ? "bg-[#0E9F6E] text-white" : active ? "bg-[#1A6CE4] text-white" : "bg-[#E3E8F2] text-[#5A6782]",
                ].join(" ")}
                aria-hidden="true"
              >
                {done ? "✓" : stepNum}
              </span>
              <span className={`hidden sm:inline ${active ? "font-semibold text-[#16223F]" : ""}`}>{label}</span>
              <span className="sr-only">
                {label}
                {done ? " (completed)" : active ? " (current step)" : ""}
              </span>
            </span>
            {stepNum < steps.length ? (
              <span className={`h-0.5 min-w-[18px] flex-1 ${done ? "bg-[#0E9F6E]" : "bg-[#E3E8F2]"}`} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
