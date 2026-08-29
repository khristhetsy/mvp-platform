import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FounderNextAction } from "@/lib/founder/stage-gate-status";

/** The single highest-impact next step, up top. Gate-aware: the CTA is derived
 *  from the founder's real stage + entitlements, so it never links to a locked page. */
export function FounderNextActionHero({ action }: { action: FounderNextAction }) {
  return (
    <section className="rounded-2xl bg-[#0A1A40] p-5 text-white">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#85B7EB]">Your next step</p>
      <h2 className="mt-1 text-lg font-semibold">{action.title}</h2>
      {action.description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/70">{action.description}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={action.cta.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E78F5] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          {action.cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {action.secondaryCta ? (
          <Link
            href={action.secondaryCta.href}
            className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/85 hover:border-white/40 hover:text-white"
          >
            {action.secondaryCta.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
