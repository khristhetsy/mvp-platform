import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { IrAgentStudio } from "@/components/ir-agent/IrAgentStudio";
import { PageHeader } from "@/components/ui/PageHeader";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";
import { loadFounderAgentContext } from "@/lib/ir-agent/founder";
import { IR_AGENT_FEATURE_KEY } from "@/lib/ir-agent/store";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * My Investor Relations Agent: the founder builds, trains and shares an agent
 * modeled on Johnny, served at icapos.com/[company]/[ending].
 */
export default async function FounderIrAgentPage() {
  const profile = await requireRole(["founder"]);
  await assertFeatureEnabled("founder", IR_AGENT_FEATURE_KEY, "/founder");
  const ctx = await loadFounderAgentContext(profile);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="My Investor Relations Agent">
      <FounderJourneyGate minStage="deploy">
        <PageHeader
          eyebrow="Stage 3 · Marketing"
          title="My Investor Relations Agent"
          description="Raising capital 24/7, nonstop. Your agent talks to investors, learns how they invest, answers from what you teach it, and books the call on your calendar."
        />
        {!ctx || !ctx.access.allowed ? (
          <AccessNotice reason={ctx?.access.reason ?? "no_org"} />
        ) : !ctx.agent ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Add your company name in{" "}
            <Link href="/founder/settings" className="font-semibold underline">
              Company profile
            </Link>{" "}
            first. Your agent&apos;s address is built from it.
          </div>
        ) : (
          <IrAgentStudio />
        )}
      </FounderJourneyGate>
    </FounderAppShell>
  );
}

function AccessNotice({ reason }: { reason: string }) {
  const copy: Record<string, string> = {
    plan: "Your plan does not include the investor relations agent yet. Upgrade to turn it on.",
    override_deny: "The investor relations agent is turned off for this account. Contact the iCFO team if you think that is wrong.",
    feature_off: "The investor relations agent is not available right now.",
    no_org: "Your company is not linked to an organization account yet, so your agent cannot be created. Nothing is missing from your company profile. Contact iCFO Customer Support and we will link it for you.",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
      <p>{copy[reason] ?? copy.feature_off}</p>
      {reason === "plan" ? (
        <Link href="/upgrade" className="mt-4 inline-block rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5]">
          See plans
        </Link>
      ) : null}
    </div>
  );
}
