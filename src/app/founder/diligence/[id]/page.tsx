import { FounderAppShell } from "@/components/FounderAppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadFounderView } from "@/lib/diligence/founder";
import { FounderSurface } from "@/components/diligence/FounderSurface";

export const dynamic = "force-dynamic";

export default async function FounderDiligencePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const view = await loadFounderView(supabase, id);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={t("diligence")}>
      {view ? (
        <FounderSurface engagementId={id} view={view} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">{t("nothing_to_review_yet")}</h1>
          <p className="mt-1 text-sm text-slate-600">This diligence report isn&apos;t available to you yet. You&apos;ll be notified when it&apos;s ready for your input.</p>
        </div>
      )}
    </FounderAppShell>
  );
}
