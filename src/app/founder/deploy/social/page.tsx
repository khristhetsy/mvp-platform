import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { getFounderSocialUsage } from "@/lib/social/founder-limits";
import { FounderSocialClient } from "@/components/founder/social/FounderSocialClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social media" };

export default async function FounderSocialPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const sp = (await searchParams) ?? {};
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const usage = await getFounderSocialUsage(profile.id).catch(() => null);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? "Your company"}>
      <FounderJourneyGate minStage="deploy">
        <div className="mb-4">
          <Link href="/founder/deploy" className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700">← Outreach</Link>
        </div>
        {usage?.enabled ? (
          <FounderSocialClient initialUsage={usage} companyName={company?.company_name ?? null} initialTab={sp.tab ?? null} />
        ) : (
          <>
            <PageHeader eyebrow="Stage 3 Marketing" title="Social media" description="Post to your own LinkedIn, Facebook, Instagram and Reddit accounts from one place." />
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-6">
              <p className="text-sm font-semibold text-slate-900">Social media is included with Basic and Professional.</p>
              <p className="mt-1 text-sm text-slate-600">Upgrade to write with the AI agent, schedule posts and see which post led to a meeting.</p>
              <Link href="/pricing" className="mt-4 inline-block rounded-full bg-[#1A6CE4] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2E78F5]">See plans</Link>
            </div>
          </>
        )}
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
