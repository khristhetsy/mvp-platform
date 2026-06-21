import { FounderAppShell } from "@/components/FounderAppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadFounderView } from "@/lib/diligence/founder";
import { FounderSurface } from "@/components/diligence/FounderSurface";

export const dynamic = "force-dynamic";

export default async function FounderDiligencePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["founder"]);
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const view = await loadFounderView(supabase, id);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Diligence">
      {view ? (
        <FounderSurface engagementId={id} view={view} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Nothing to review yet</h1>
          <p className="mt-1 text-sm text-slate-600">This diligence report isn&apos;t available to you yet. You&apos;ll be notified when it&apos;s ready for your input.</p>
        </div>
      )}
    </FounderAppShell>
  );
}
