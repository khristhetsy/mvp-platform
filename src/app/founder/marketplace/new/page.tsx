import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ListingForm } from "./listing-form";

export const dynamic = "force-dynamic";

export default async function FounderNewListingPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  let offeringType: string | null = null;
  if (company) {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const { data } = await admin.from("companies").select("offering_type").eq("id", company.id).maybeSingle();
    offeringType = (data as { offering_type?: string } | null)?.offering_type ?? null;
  }
  const isRegCf = offeringType === "reg_cf";

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Marketplace"
          title="List your Reg CF offering"
          description="Create a tombstone listing that links to your registered funding portal. Reviewed before it goes live."
        />

        {!company ? (
          <p className="text-sm text-slate-600">Complete your company setup first.</p>
        ) : !isRegCf ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Public listings are for Reg CF offerings only.</p>
            <p className="mt-1">
              Your capital structure isn&apos;t set to Regulation Crowdfunding. Private (Reg D) raises are never listed publicly —
              they connect with investors through private matching instead.
            </p>
            <Link href="/founder/offering-type" className="mt-3 inline-block font-semibold text-[#1A6CE4] underline">
              Update capital structure
            </Link>
          </div>
        ) : (
          <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
            <ListingForm defaultCompanyName={company.company_name} />
          </div>
        )}
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
