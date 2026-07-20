import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getFounderMatchQueue, countViewersForFounder } from "@/lib/matching/queue";
import { FounderMatchQueue } from "@/components/matching/FounderMatchQueue";

export const dynamic = "force-dynamic";

export default async function FounderMatchesPage() {
  const profile = await requireRole(["founder"]);
  const { items, companyIds } = await getFounderMatchQueue(profile.id);
  const viewers = await countViewersForFounder(companyIds);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Investor matches"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Investor matches"
          description="Investors who've expressed interest. Approve to make a mutual introduction."
        />

        <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <span className="text-slate-500">Investors who&apos;ve viewed your profile</span>
          <span className="rounded-full bg-[#EAF1FD] px-2.5 py-0.5 font-semibold text-[#1A6CE4]">{viewers}</span>
        </div>

        <FounderMatchQueue items={items} />
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
