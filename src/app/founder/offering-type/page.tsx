import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ProgressSteps } from "@/components/onboarding/ProgressSteps";
import { DisclosureBanner } from "@/components/onboarding/DisclosureBanner";
import { offeringTypeCopy } from "@/lib/onboarding/offering-type-copy";
import type { OfferingType } from "@/lib/onboarding/offering-type-schema";
import { OfferingTypeForm } from "./offering-type-form";

export const dynamic = "force-dynamic";

export default async function FounderOfferingTypePage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) redirect("/founder/onboarding");

  // Pre-select the saved value only if the founder previously attested (returning
  // to the step). Re-visiting always requires re-attesting (checkbox starts off).
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data: row } = await admin
    .from("companies")
    .select("offering_type, offering_type_attested_at")
    .eq("id", company.id)
    .maybeSingle();
  const initialValue: OfferingType | null =
    row?.offering_type_attested_at ? ((row.offering_type as OfferingType) ?? null) : null;

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-[#16223F]">
      {/* Topbar */}
      <header className="flex items-center justify-between bg-gradient-to-r from-[#0A1A40] via-[#12408F] to-[#1A6CE4] px-8 py-3.5 text-white">
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="20" r="17" stroke="#FFFFFF" strokeOpacity=".9" strokeWidth="2.6" />
            <rect x="12" y="21" width="4" height="7" rx="1.2" fill="#FFFFFF" />
            <rect x="18" y="17" width="4" height="11" rx="1.2" fill="#FFFFFF" />
            <rect x="24" y="12" width="4" height="16" rx="1.2" fill="#FFFFFF" />
          </svg>
          <span className="text-[17px] font-semibold tracking-[0.2px]">iCapOS</span>
        </div>
        <span className="text-[13px] opacity-85">{offeringTypeCopy.stepLabel}</span>
      </header>

      {/* Progress */}
      <div className="pt-7">
        <ProgressSteps steps={offeringTypeCopy.progress.steps} current={offeringTypeCopy.progress.current} />
      </div>

      {/* Card */}
      <main className="mx-auto mb-16 mt-6 max-w-[760px] rounded-2xl border border-[#E3E8F2] bg-white px-5 py-8 shadow-[0_8px_30px_rgba(10,26,64,.06)] sm:px-11 sm:py-10">
        <h1 className="text-[26px] font-bold text-[#0A1A40]">{offeringTypeCopy.title}</h1>
        <p className="mb-6 mt-1.5 text-[15px] text-[#5A6782]">{offeringTypeCopy.subtitle}</p>

        <DisclosureBanner heading={offeringTypeCopy.disclosure.heading}>
          {offeringTypeCopy.disclosure.body}
        </DisclosureBanner>

        <OfferingTypeForm initialValue={initialValue} />
      </main>

      <p className="mx-auto mb-10 max-w-[760px] px-5 text-center text-[11.5px] leading-[1.6] text-[#8B96AC]">
        {offeringTypeCopy.legalFooter}
      </p>
    </div>
  );
}
