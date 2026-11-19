import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupportPolicyContent } from "@/components/support/SupportPolicyContent";
import { requireRole } from "@/lib/supabase/auth";
import { getFounderConnectionConfig } from "@/lib/settings/platform-settings";
import { buildPlanLimitRows } from "@/lib/support/policy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support policy" };

export default async function FounderSupportPolicyPage() {
  const profile = await requireRole(["founder"]);
  const planRows = buildPlanLimitRows(await getFounderConnectionConfig());
  const founderName = profile.full_name ?? profile.email ?? "Founder";

  return (
    <FounderAppShell profileName={founderName} profileSubtitle="Support">
      <Link href="/founder/support" className="text-[13px] font-semibold text-indigo-700 hover:text-indigo-900">
        <span aria-hidden="true">←</span> Back to Support
      </Link>
      <div className="mt-3">
        <PageHeader eyebrow="Help" title="Customer Support Policy" description="What to expect when you contact the iCFO team." />
      </div>
      <SupportPolicyContent audience="founder" planRows={planRows} />
    </FounderAppShell>
  );
}
